'use strict'

const superagent = require('superagent')

async function getServerConfig(base, timeout) {
  const getVersion = await superagent
    .get(base + '/version.json')
    .timeout(timeout)
  const { version } = getVersion.body

  const getLiqiVersion = await superagent
    .get(base + `/resversion${version}.json`)
    .timeout(timeout)
  const liqiVersion = getLiqiVersion.body.res['res/proto/liqi.json'].prefix

  const getLiqi = await superagent
    .get(base + `/${liqiVersion}/res/proto/liqi.json`)
    .timeout(timeout)
  const liqi = getLiqi.body

  const getServiceDiscoveryServers = await superagent
    .get(base + `/v${version}/config.json`)
    .timeout(timeout)
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
      const res = await superagent.head(url)
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

  return getCtlEndpoints.body.servers.map(p => 'wss://' + p)
}

module.exports = {
  getServerConfig,
  chooseFastestServer,
  getCtlEndpoints,
}
