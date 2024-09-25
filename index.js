'use strict'

const Koa = require('koa')
const Router = require('@koa/router')
const auth = require('koa-basic-auth')
const config = require('./config.js')
const process = require('process')
const Client = require('./client.js');


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

  if (config.apiAuth != null) {
    app.use(auth(config.apiAuth))
  }

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

  console.error(`Serving on http://${config.addr}:${config.port}`)
})().catch(err => {
  console.error(err.stack || err.message || err)
  process.exit(1)
})
