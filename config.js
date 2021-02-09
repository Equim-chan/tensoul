'use strict'

const process = require('process')

const config = {
  mjsoul: {
    // US: wss://mjusgs.mahjongsoul.com:9663
    // JP: wss://mjjpgs.mahjongsoul.com:9663
    url: process.env.ENDPOINT || 'wss://mjjpgs.mahjongsoul.com:9663',
    timeout: 10000,
  },
  login: {
    type: 10,
    access_token: process.env.ACCESS_TOKEN,
  },
  port: process.env.PORT || 2563,
  addr: '0.0.0.0',
}

if (!config.login.access_token) {
  console.error('missing access token')
  process.exit(1)
}

module.exports = config
