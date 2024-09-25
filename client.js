"use strict";

const pb = require("protobufjs");
const MJSoul = require("mjsoul");
const superagent = require("superagent");
require("superagent-proxy")(superagent);
const { HttpsProxyAgent } = require("https-proxy-agent");

const { toTenhou } = require("./convert.js");
const deobfuse = require("./deobfuse.js");
const ServerConfig = require("./server_config.js");

const process = require("process");
const EventEmitter = require("events");

class Client {
  constructor(config) {
    this._config = config;
    this._serverConfig = new ServerConfig(config);
  }

  async init() {
    this._condvar = new EventEmitter();
    this._is_logged_in = false;

    const scfg = await this._serverConfig.getServerConfig(
      this._config.mjsoul.base,
      this._config.mjsoul.timeout,
    );
    console.error(scfg);

    this._serverVersion = scfg.version;
    this._clientVersionString =
      "web-" + this._serverVersion.replace(/\.w$/, "");

    const root = pb.Root.fromJSON(scfg.liqi);
    const wrapper = root.lookupType("Wrapper");

    let gateway = this._config.mjsoul.gateway;
    if (gateway == null) {
      const endpoint = await this._serverConfig.chooseFastestServer(
        scfg.serviceDiscoveryServers,
      );
      gateway = (await this._serverConfig.getCtlEndpoints(endpoint)).shift();
    }
    console.error(`using ${gateway}`);

    this._mjsoul = new MJSoul({
      url: gateway,
      timeout: this._config.mjsoul.timeout,
      root,
      wrapper,
      wsOption: {
        agent:
          process.env.https_proxy &&
          new HttpsProxyAgent(process.env.https_proxy),
        origin: this._config.mjsoul.base,
        headers: {
          "User-Agent": this._config.userAgent,
        },
      },
    });

    this._mjsoul.on("NotifyAccountLogout", () => this.login());
    this._mjsoul.open(() => this.login());

    if (this._config.forceReLoginIntervalMs > 0) {
      process.nextTick(async () => {
        while (true) {
          await new Promise((resolve) =>
            setTimeout(resolve, this._config.forceReLoginIntervalMs),
          );
          this._is_logged_in = false;
          this._mjsoul.close();

          this._mjsoul = new MJSoul({
            url: gateway,
            timeout: this._config.mjsoul.timeout,
            root,
            wrapper,
            wsOption: {
              agent:
                process.env.https_proxy &&
                new HttpsProxyAgent(process.env.https_proxy),
              origin: this._config.mjsoul.base,
              headers: {
                "User-Agent": this._config.userAgent,
              },
            },
          });

          this._mjsoul.on("NotifyAccountLogout", () => this.login());
          this._mjsoul.open(() => this.login());
        }
      });
    }
  }

  async login() {
    try {
      this._is_logged_in = false;
      console.error("login triggered");

      const login = {
        client_version_string: this._clientVersionString,
        client_version: {
          resource: this._serverVersion,
        },
        ...this._config.login,
      };
      const res = await this._mjsoul.sendAsync("oauth2Login", login);
      console.error("login done");
      this._is_logged_in = true;
      this._condvar.emit("logged_in");

      return res;
    } catch (err) {
      console.error(err.stack || err);
      process.exit(1);
    }
  }

  async tenhouLogFromMjsoulID(id) {
    const seps = id.split("_");
    let logID = seps[0];
    let targetID;

    if (seps.length >= 3 && seps[2] === "2") {
      // "anonymized" log id
      logID = deobfuse.decodeLogID(logID);
    }
    if (seps.length >= 2) {
      if (seps[1].charAt(0) === "a") {
        targetID = deobfuse.decodeAccountID(parseInt(seps[1].substring(1)));
      } else {
        targetID = parseInt(seps[1]);
      }
    }

    while (!this._is_logged_in) {
      await new Promise((resolve) => this._condvar.once("logged_in", resolve));
    }

    const log = await this._mjsoul.sendAsync("fetchGameRecord", {
      game_uuid: logID,
      client_version_string: this._clientVersionString,
    });

    if (log.data_url) {
      // data_url is for some very old logs
      log.data = (
        await superagent
          .get(log.data_url)
          .proxy(process.env.https_proxy)
          .buffer(true)
      ).body;
    }

    const detailRecords = this._mjsoul.wrapper.decode(log.data);
    const name = detailRecords.name.substring(4);
    const data = detailRecords.data;
    const payload = this._mjsoul.root.lookupType(name).decode(data);
    if (payload.version < 210715 && payload.records.length > 0) {
      log.data = payload.records.map((value) => {
        const raw = this._mjsoul.wrapper.decode(value);
        return this._mjsoul.root.lookupType(raw.name).decode(raw.data);
      });
    } else {
      // for version 210715 or later
      log.data = payload.actions
        .filter((action) => action.result && action.result.length > 0)
        .map((action) => {
          const raw = this._mjsoul.wrapper.decode(action.result);
          return this._mjsoul.root.lookupType(raw.name).decode(raw.data);
        });
    }

    const tenhouLog = toTenhou(log);

    if (targetID != null) {
      for (let acc of log.head.accounts) {
        if (acc.account_id === targetID) {
          tenhouLog._target_actor = acc.seat;
          break;
        }
      }
    }

    return tenhouLog;
  }
}

module.exports = Client;
