'use strict'

const superagent = require('superagent')
require('superagent-proxy')(superagent)
const process = require('process')
const config = require('./config.js')

const userAgent = config.userAgent

async function getServerConfig(base) {
  const getVersion = await superagent
    .get(base + '/version.json')
    .query({randv: Math.floor((1 + Math.random()) * Date.now())})
    .set('User-Agent', userAgent)
    // .proxy(process.env.https_proxy)
  const { version } = getVersion.body

  const getLiqiVersion = await superagent
    .get(base + `/resversion${version}.json`)
    .set('User-Agent', userAgent)
    // .proxy(process.env.https_proxy)
  const liqiVersion = getLiqiVersion.body.res['res/proto/liqi.json'].prefix

  const getLiqi = await superagent
    .get(base + `/${liqiVersion}/res/proto/liqi.json`)
    .set('User-Agent', userAgent)
    // .proxy(process.env.https_proxy)
  const liqi = getLiqi.body

  const getServiceDiscoveryServers = await superagent
    .get(base + `/v${version}/config.json`)
    .set('User-Agent', userAgent)
    // .proxy(process.env.https_proxy)
  const serviceDiscoveryServers = getServiceDiscoveryServers.body.ip[0].region_urls.map(o => o.url)

  return {
    version,
    liqiVersion,
    liqi,
    serviceDiscoveryServers,
  }
}

async function chooseFastestServer(urls) {
  return await Promise.any(
    urls.map(async url => {
      const res = await superagent
        .head(url)
        .set('User-Agent', userAgent)
    // .proxy(process.env.https_proxy)
      if (res.status === 200) {
        return url
      }
    })
  )
}

async function getCtlEndpoints(serviceDiscoveryServer) {
  const query = {
    protocol: 'ws',
    ssl: true,
    service: 'ws-gateway',
  }
  const getCtlEndpoints = await superagent
    .get(serviceDiscoveryServer)
    .query(query)
    .set('User-Agent', userAgent)
    // .proxy(process.env.https_proxy)

  return getCtlEndpoints.body.servers.map(p => 'wss://' + p)
}


module.exports = {
  getServerConfig,
  chooseFastestServer,
  getCtlEndpoints,
}
