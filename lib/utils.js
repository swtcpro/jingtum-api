/**
 * Created by Administrator on 2017/2/13.
 */
'use strict';

var utf8 = require('utf8');
var BN = require('bn.js');
var jutils = require('jingtum-lib').utils;
var bignumber = require('bignumber.js');
var config  = require('./config');
const CURRENCY = config.get('base_currency') || 'SWT';

function filterErr(code, done) {
  return function(e) {
    done(e.code !== code ? e : void(0));
  };
}

function throwErr(done) {
  return function(e) {
    if (e) {
      throw e;
    }
    done();
  };
}

function trace(comment, func) {
  return function() {
    console.log('%s: %s', trace, arguments.toString);
    func(arguments);
  };
}

function arraySet(count, value) {
  var a = new Array(count);

  for (var i = 0; i < count; i++) {
    a[i] = value;
  }

  return a;
}

function hexToString(h) {
  var a = [];
  var i = 0;

  if (h.length % 2) {
    a.push(String.fromCharCode(parseInt(h.substring(0, 1), 16)));
    i = 1;
  }

  for (; i < h.length; i += 2) {
    a.push(String.fromCharCode(parseInt(h.substring(i, i + 2), 16)));
  }

  return a.join('');
}

function stringToHex(s) {
  var result = '';
  for (var i = 0; i < s.length; i++) {
    var b = s.charCodeAt(i);
    result += b < 16 ? '0' + b.toString(16) : b.toString(16);
  }
  return result;
}

/**
 * use utf8 encoding with hex representation
 */
function stringToUtf8(s) {
  return stringToHex(utf8.encode(s))
}

/**
 * use utf8 decoding with hex representation
 */
function utf8ToString(u) {
  return utf8.decode(hexToString(u))
}

function stringToArray(s) {
  var a = new Array(s.length);

  for (var i = 0; i < a.length; i += 1) {
    a[i] = s.charCodeAt(i);
  }

  return a;
}

function hexToArray(h) {
  return stringToArray(hexToString(h));
}

function chunkString(str, n, leftAlign) {
  var ret = [];
  var i = 0,
    len = str.length;

  if (leftAlign) {
    i = str.length % n;
    if (i) {
      ret.push(str.slice(0, i));
    }
  }

  for (; i < len; i += n) {
    ret.push(str.slice(i, n + i));
  }

  return ret;
}

function assert(assertion, msg) {
  if (!assertion) {
    throw new Error('Assertion failed' + (msg ? ': ' + msg : '.'));
  }
}

/**
 * Return unique values in array.
 */
function arrayUnique(arr) {
  var u = {},
    a = [];

  for (var i = 0, l = arr.length; i < l; i++) {
    var k = arr[i];
    if (u[k]) {
      continue;
    }
    a.push(k);
    u[k] = true;
  }

  return a;
}

/**
 * Convert a jingtum epoch to a JavaScript timestamp.
 *
 * JavaScript timestamps are unix epoch in milliseconds.
 */
function toTimestamp(rpepoch) {
  return (rpepoch + 0x386D4380) * 1000;
}

/**
 * Convert a JavaScript timestamp or Date to a Ripple epoch.
 *
 * JavaScript timestamps are unix epoch in milliseconds.
 */
function fromTimestamp(rpepoch) {
  if (rpepoch instanceof Date) {
    rpepoch = rpepoch.getTime();
  }

  return Math.round(rpepoch / 1000) - 0x386D4380;
}

function bytesToHex(a) {
  return a.map(function (byteValue) {
    var hex = byteValue.toString(16).toUpperCase();
    return hex.length > 1 ? hex : '0' + hex;
  }).join('');
}

function hexToBytes(a) {
  assert(a.length % 2 === 0);
  return new BN(a, 16).toArray(null, a.length / 2);
}

exports.time = {
  fromJingtum: toTimestamp,
  toJingtum: fromTimestamp
};

function isStrAmount(input) {//路由中传递的Amount是否正确
  var val = input.split('+');
  if(val.length != 3 && val.length !=2)
    return false;
  if(val.length === 2 && val[1] !== CURRENCY)
    return false;
  if(val.length === 3 && val[1] === CURRENCY)//swt没有issuer。
    return false;
  if(isNaN(val[0]))
    return false;
  if(!jutils.isValidCurrency(val[1]))
    return false;
  if(val.length ===3 && !jutils.isValidAddress(val[2]))
    return false;
  return true;
}

function str2Amount(input){
  var val = input.split('+');
  return {value: val[0], currency: val[1], issuer: val[2] || ''};
}

/*
* offer:源对象
* order:新对象
* type:挂单类型
* 功能：将源对象offer转换成pair格式后，结果存到order中。
* */
function taker2pairs(offer, order, type){
  var gets = offer.taker_gets || offer.gets || offer.paid;
  var pays = offer.taker_pays || offer.pays || offer.got;
  if(type === 'buy' || type === 'bought'){
    order.pair = pays.currency + (pays.currency === CURRENCY ?'':':') + pays.issuer + '/' + gets.currency + (gets.currency === CURRENCY ?'':':') + gets.issuer;
    order.amount = pays.value;
    order.price = new bignumber(gets.value).dividedBy(new bignumber(pays.value));
  }else if(type === 'sell' || type === 'sold'){
    order.pair = gets.currency + (gets.currency === CURRENCY ?'':':') + gets.issuer + '/' + pays.currency + (pays.currency === CURRENCY ?'':':') + pays.issuer;
    order.amount = gets.value;
    order.price = new bignumber(pays.value).dividedBy(gets.value);
  }
}

/*
* 获得访问用户的ip
* */
function getClientIp(req) {
    return req.headers['x-real-ip'] || req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress;
}

exports.trace = trace;
exports.arraySet = arraySet;
exports.hexToString = hexToString;
exports.hexToArray = hexToArray;
exports.stringToArray = stringToArray;
exports.stringToHex = stringToHex;
exports.chunkString = chunkString;
exports.assert = assert;
exports.arrayUnique = arrayUnique;
exports.toTimestamp = toTimestamp;
exports.fromTimestamp = fromTimestamp;
exports.utf8ToString = utf8ToString;
exports.stringToUtf8 = stringToUtf8;
exports.bytesToHex = bytesToHex;
exports.hexToBytes = hexToBytes;
exports.isStrAmount = isStrAmount;
exports.str2Amount = str2Amount;
exports.taker2pairs = taker2pairs;
exports.getClientIp = getClientIp;
