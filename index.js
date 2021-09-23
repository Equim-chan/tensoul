'use strict'

const pb = require("protobufjs")
const MJSoul = require('mjsoul')
const Koa = require('koa')
const Router = require('@koa/router')
const superagent = require('superagent')
require('superagent-proxy')(superagent)
const ProxyAgent = require('proxy-agent')
const process = require('process')
const EventEmitter = require('events')
const { toTenhou } = require('./convert.js')
const deobfuse = require('./deobfuse.js')
const serverConfig = require('./server_config.js')
const config = require('./config.js')

class Client {
  constructor() {}

  async init() {
    this._condvar = new EventEmitter()
    this._is_logged_in = false

    const scfg = await serverConfig.getServerConfig(config.mjsoul.base, config.mjsoul.timeout)
    this._serverVersion = scfg.version
    this._clientVersionString = 'web-' + this._serverVersion.replace(/\.w$/, '')

    const root = pb.Root.fromJSON(scfg.liqi)
    const wrapper = root.lookupType('Wrapper')

    let gateway = config.mjsoul.gateway
    if (gateway == null) {
      const endpoint = await serverConfig.chooseFastestServer(scfg.serviceDiscoveryServers)
      gateway = (await serverConfig.getCtlEndpoints(endpoint)).shift()
    }
    console.error(`using ${gateway}`)

    this._mjsoul = new MJSoul({
      url: gateway,
      timeout: config.mjsoul.timeout,
      root,
      wrapper,
      wsOption: {
        agent: new ProxyAgent(process.env.https_proxy),
        origin: config.mjsoul.base,
        headers: {
          'User-Agent': config.userAgent,
        }
      },
    })

    this._mjsoul.on('NotifyAccountLogout', () => this.login())
    this._mjsoul.open(() => this.login())
  }

  async login() {
    try {
      this._is_logged_in = false
      console.error('login triggered')

      await this._mjsoul.sendAsync('heatbeat')

      const login = {
        client_version_string: this._clientVersionString,
        ...config.login
      }
      const res = await this._mjsoul.sendAsync('oauth2Login', login)
      console.error('login done')
      this._is_logged_in = true
      this._condvar.emit('logged_in')

      return res
    } catch (err) {
      console.error(err.stack || err)
      process.exit(1)
    }
  }

  async tenhouLogFromMjsoulID(id) {
    const seps = id.split('_')
    let logID = seps[0]
    let targetID

    if (seps.length >= 3 && seps[2] === '2') {
      // "anonymized" log id
      logID = deobfuse.decodeLogID(logID)
    }
    if (seps.length >= 2) {
      if (seps[1].charAt(0) === 'a') {
        targetID = deobfuse.decodeAccountID(parseInt(seps[1].substring(1)))
      } else {
        targetID = parseInt(seps[1])
      }
    }

    while (!this._is_logged_in) {
      await new Promise(resolve => this._condvar.once('logged_in', resolve))
    }

    const log = await this._mjsoul.sendAsync('fetchGameRecord', {
      game_uuid: logID,
      client_version_string: this._clientVersionString,
    })

    if (log.data_url) {
      // data_url is for some very old logs
      log.data = (await superagent.get(log.data_url).proxy(process.env.https_proxy).buffer(true)).body
    }

    const detailRecords = this._mjsoul.wrapper.decode(log.data)
    const name = detailRecords.name.substring(4)
    const data = detailRecords.data
    const payload = this._mjsoul.root.lookupType(name).decode(data)
    if (payload.version < 210715 && payload.records.length > 0) {
      log.data = payload.records.map(value => {
        const raw = this._mjsoul.wrapper.decode(value)
        return this._mjsoul.root.lookupType(raw.name).decode(raw.data)
      })
    } else {
      // for version 210715 or later
      log.data = payload.actions
        .filter(action => action.result && action.result.length > 0)
        .map(action => {
          const raw = this._mjsoul.wrapper.decode(action.result)
          return this._mjsoul.root.lookupType(raw.name).decode(raw.data)
        })
    }

    const tenhouLog = toTenhou(log)

    if (targetID != null) {
      for (let acc of log.head.accounts) {
        if (acc.account_id === targetID) {
          tenhouLog._target_actor = acc.seat
          break
        }
      }
    }

    return tenhouLog
  }
}

(async () => {
  const client = new Client()
  await client.init()

  if (process.argv.length > 2) {
    // CLI
    const id = process.argv[2]
    const result = await client.tenhouLogFromMjsoulID(id)
    console.log(JSON.stringify(result))
    process.exit(0)
  }
  // Server
  const app = new Koa()
  const router = new Router()

  router
    .get('/', async (ctx) => {
      ctx.body = 'Usage:\n'
        + '  GET /convert?id={mahjong_soul_log_id}\n'
        + '\n'
        + 'Repo: https://github.com/Equim-chan/tensoul\n'
    })
    .get('/convert', async (ctx) => {
      const id = ctx.query.id
      if (!id) {
        ctx.status = 400
        ctx.body = { error: 'missing param `id`' }
        return
      }

      try {
        ctx.body = await client.tenhouLogFromMjsoulID(id)
      } catch (err) {
        ctx.status = 500
        ctx.body = { error: err.message || err.error || err }
      }
    })

  app.use(router.routes())
  app.listen(config.port, config.addr)

  console.error('Serving on http://' + addr + ':' + port)
})().catch(err => {
  console.error(err.stack || err.message || err)
  process.exit(1)
})
