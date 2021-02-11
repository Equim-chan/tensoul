'use strict'

const https = require('https')

exports.get = async (url) => {
  const res = await new Promise((resolve, reject) => https.get(url, resolve).on('error', reject))
  if (res.statusCode >= 400) {
    throw new Error(res.statusCode.toString() + ' ' + res.statusMessage)
  }

  let body = Buffer.allocUnsafe(0)
  res.on('data', data => body = Buffer.concat([body, data]))

  await new Promise(resolve => res.on('end', resolve))
  return body
}
