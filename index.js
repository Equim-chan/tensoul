'use strict'

const MJSoul = require('mjsoul')
const Koa = require('koa')
const Router = require('@koa/router')
const process = require('process')
const EventEmitter = require('events')
const requests = require('./requests.js')
const { toTenhou } = require('./convert.js')
const deobfuse = require('./deobfuse.js')
const config = require('./config.js')

const port = config.port || 2563
const addr = config.addr || '127.0.0.1'
const mjsoulConf = config.mjsoul
const loginConf = config.login
const mjsoul = new MJSoul(mjsoulConf)

const condvar = new EventEmitter()
let is_logged_in = false

async function login() {
  try {
    is_logged_in = false
    console.error('login triggered')

    const res = await mjsoul.sendAsync('oauth2Login', loginConf)

    console.error('login done')
    is_logged_in = true
    condvar.emit('logged_in')

    return res
  } catch (err) {
    console.error(err.stack || err)
    process.exit(1)
  }
}

async function tenhouLogFromMjsoulID(id) {
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

  while (!is_logged_in) {
    await new Promise(resolve => condvar.once('logged_in', resolve))
  }

  const log = await mjsoul.sendAsync('fetchGameRecord', {
    game_uuid: logID,
  })

  if (log.data_url) {
    log.data = await requests.get(log.data_url)
  }

  const detailRecords = mjsoul.wrapper.decode(log.data)

  const name = detailRecords.name.substring(4)
  const data = detailRecords.data
  const resGameRecord = mjsoul.root.lookupType(name).decode(data)

  log.data = resGameRecord.records.map(value => {
    const raw = mjsoul.wrapper.decode(value)
    return mjsoul.root.lookupType(raw.name).decode(raw.data)
  })

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

(async () => {
  mjsoul.on('NotifyAccountLogout', login)
  mjsoul.open(login)

  if (process.argv.length > 2) {
    // CLI
    const id = process.argv[2]
    const result = await tenhouLogFromMjsoulID(id)
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
        ctx.body = await tenhouLogFromMjsoulID(id)
      } catch (err) {
        ctx.status = 500
        ctx.body = { error: err.message || err.error || err }
      }
    })

  app.use(router.routes())
  app.listen(port, addr)

  console.error('Serving on http://' + addr + ':' + port)
})().catch(err => {
  console.error(err.stack || err.message || err)
  process.exit(1)
})
