'use strict'

const MJSoul = require('mjsoul')
const Koa = require('koa')
const Router = require('@koa/router')
const process = require('process')
const { toTenhou } = require('./convert.js')
const config = require('./config.js')

const port = config.port || 2563
const addr = config.addr || '127.0.0.1'
const mjsoulConf = Object.assign({}, config.mjsoul)
const loginConf = Object.assign({ type: 10 }, config.login)
const mjsoul = new MJSoul(mjsoulConf)

async function init() {
  try {
    console.log('login triggered')
    await mjsoul.sendAsync('oauth2Login', loginConf)
    console.log('login done')
  } catch (err) {
    console.error(err.stack || err)
    process.exit(1)
  }
}

mjsoul.on('NotifyAccountLogout', init)
mjsoul.open(init)

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
    let id = ctx.query.id
    if (!id) {
      ctx.status = 400
      ctx.body = { error: 'missing param `id`' }
      return
    }
    id = id.replace(/_.*$/, '')

    try {
      const log = await mjsoul.sendAsync('fetchGameRecord', {
        game_uuid: id,
      })
      const detailRecords = mjsoul.wrapper.decode(log.data)

      const name = detailRecords.name.substr(4)
      const data = detailRecords.data
      const resGameRecord = mjsoul.root.lookupType(name).decode(data)

      log.data = resGameRecord.records.map(value => {
        const raw = mjsoul.wrapper.decode(value)
        return mjsoul.root.lookupType(raw.name).decode(raw.data)
      })

      ctx.body = toTenhou(log)
    } catch (err) {
      ctx.status = 500
      ctx.body = { error: err.message || err.error || err }
    }
  })

app.use(router.routes())
app.listen(port, addr)

console.log('Serving on http://' + addr + ':' + port)
