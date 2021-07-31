'use strict'

const process = require('process')

const config = {
  mjsoul: {
    // US: wss://mjusgs.mahjongsoul.com:9663
    // JP: wss://mjjpgs.mahjongsoul.com:9663
    base: 'https://mahjongsoul.game.yo-star.com', // process.env.MJS_BASE,
    // url: process.env.ENDPOINT || 'wss://mjjpgs.mahjongsoul.com:9663',
    timeout: 10000,
  },

  login: {
    type: 10,
    access_token: 'fdfefa0e-4eb9-44d1-bd42-101c1cf37f7b', // process.env.ACCESS_TOKEN,
    deviceID: '1c10e503-6719-4434-9792-55ecc9ca76ec',
    device: {
      hardware: 'pc',
      is_browser: true,
      os: 'windows',
      os_version: 'win10',
      platform: 'pc',
      sale_platform: 'web',
      software: 'Chrome',
    },
    random_key: 'cad225d2-eb0d-4e6b-b424-9a39677a87af',
  },

  port: process.env.PORT || 2563,
  addr: '0.0.0.0',
}

if (!config.login.access_token) {
  console.error('missing access token')
  process.exit(1)
}

module.exports = config
