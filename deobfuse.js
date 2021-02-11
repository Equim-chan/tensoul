'use strict'

exports.decodeLogID = (id) => {
  const zero = '0'.charCodeAt(0)
  const alpha = 'a'.charCodeAt(0)

  let ret = ''
  for (let i = 0; i < id.length; i++) {
    const ch = id.charAt(i)
    const code = ch.charCodeAt(0)

    let o
    if (code >= zero && code < zero + 10) {
      o = code - zero
    } else if (code >= alpha && code < alpha + 26) {
      o = code - alpha + 10
    } else {
      ret += ch
      continue
    }

    o = (o + 55 - i) % 36
    if (o < 10) {
      ret += String.fromCharCode(o + zero)
    } else {
      ret += String.fromCharCode(o + alpha - 10)
    }
  }

  return ret
}

exports.decodeAccountID = (id) => ((id - 1358437 ^ 86216345) - 1117113) / 7
