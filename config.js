'use strict'

const process = require('process')

const config = {
  mjsoul: {
    url: 'wss://mjusgs.mahjongsoul.com:9663',
    // url: 'wss://mjjpgs.mahjongsoul.com:9663',
    timeout: 10000,
  },
  login: {
    type: 10,
    access_token: process.env.ACCESS_TOKEN,
  },
  port: process.env.PORT,
  addr: '0.0.0.0',
}

if (!config.login.access_token) {
  console.error('missing access token')
  process.exit(1)
}

module.exports = config
