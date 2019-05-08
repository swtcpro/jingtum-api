var remote = require('../lib/remote');
var jutils = require('jingtum-lib').utils;
var utils  = require('../lib/utils');
const respond = require('../lib/respond');
var logger  = require('../lib/logger');
const resultCode = require('../lib/resultCode');
const ClientError  = require('../lib/errors').ClientError;
const NetworkError = require('../lib/errors').NetworkError;
var async = require('async');
var bignumber = require('bignumber.js');
var config  = require('../lib/config');
const CURRENCY = config.get('base_currency') || 'SWT';
const ISSUER =  config.get('issuer') || 'jGa9J9TkqtBcUoHe2zqhVFFbgUVED6o9or';
const LIMIT = 10;

function submitOrder(req, res, callback) {
    if (!remote || !remote.isConnected()) {
        logger.error(resultCode.N_REMOTE.msg);
        return callback(new NetworkError(resultCode.N_REMOTE));
    }
    var orderObj = {};
    orderObj.address = req.params.address;
    orderObj.secret = req.body.secret;
    orderObj.order = req.body.order;
    orderObj.sequence = req.body.sequence;
    if( !jutils.isValidAddress(orderObj.address)){
        return callback(new ClientError(resultCode.C_ADDRESS));
    }
    if( !jutils.isValidSecret(orderObj.secret)){
        return callback(new ClientError(resultCode.C_SECRET));
    }
    if(typeof orderObj.order !== 'object' || !orderObj.order.type || !orderObj.order.pair || !orderObj.order.amount || !orderObj.order.price){
        return callback(new ClientError(resultCode.C_ORDER));
    }
    if(orderObj.order && !/^((sell)|(buy))$/.test(orderObj.order.type)){
        return callback(new ClientError(resultCode.C_ORDER_TYPE));
    }
    if(orderObj.order && !orderObj.order.pair.indexOf('/')){
        return callback(new ClientError(resultCode.C_ORDER_PAIR));
    }
    if(orderObj.order && isNaN(orderObj.order.amount)){
        return callback(new ClientError(resultCode.C_ORDER_AMOUNT));
    }
    if(orderObj.order && isNaN(orderObj.order.price)){
        return callback(new ClientError(resultCode.C_ORDER_PRICE));
    }
    if (orderObj.sequence && !/^\+?[1-9][0-9]*$/.test(orderObj.sequence)) {//正整数
        return callback(new ClientError(resultCode.C_SEQUENCE));
    }

    var pairs = orderObj.order.pair.split('/');
    if(pairs.length <= 1)
        return callback(new ClientError(resultCode.C_ORDER_PAIR));
    var base = pairs[0].split(':');
    var counter = pairs[1].split(':');

    if(base[1] && base[1] !== ISSUER){
        return callback(new ClientError(resultCode.C_ORDER_ISSUER))
    }
    if(counter[1] && counter[1] !== ISSUER){
        return callback(new ClientError(resultCode.C_ORDER_ISSUER))
    }

    if(base[0] !== CURRENCY && (base.length <= 1 || base[1] === '')){
        return callback(new ClientError(resultCode.C_ORDER_PAIR_BASE));
    }
    if(counter[0] !== CURRENCY && (counter.length <= 1 || counter[1] === '')){
        return callback(new ClientError(resultCode.C_ORDER_PAIR_COUNTER));
    }
    if(base[0] === CURRENCY && base.length > 1){//货币是SWT,银关是空字符串
        return callback(new ClientError(resultCode.C_ORDER_BOOK_BASE));
    }
    if(counter[0] === CURRENCY && counter.length > 1){//货币是SWT,银关是空字符串
        return callback(new ClientError(resultCode.C_ORDER_BOOK_COUNTER));
    }

    if(orderObj.order.type === 'sell'){
        taker_gets = {
            value: orderObj.order.amount.toString(),
            currency: base[0],
            issuer: base[1] || ""
        };
        taker_pays = {
            value: (new bignumber(orderObj.order.amount).mul(new bignumber(orderObj.order.price))).toString(),
            currency: counter[0],
            issuer: counter[1] || ""
        };
    }else if(orderObj.order.type === 'buy'){
        taker_pays = {
            value: orderObj.order.amount.toString(),
            currency: base[0],
            issuer: base[1] || ""
        };
        taker_gets = {
            value: (new bignumber(orderObj.order.amount).mul(new bignumber(orderObj.order.price))).toString(),
            currency: counter[0],
            issuer: counter[1] || ""
        };
    }
    if(!jutils.isValidAmount(taker_gets) || !jutils.isValidAmount(taker_pays)){
        logger.error('order.pair :', orderObj.order.pair, 'taker_pays:', taker_pays,'taker_gets:', taker_gets);
        return callback(new ClientError(resultCode.C_ORDER_PAIR_CHECK));
    }

    var old_type = orderObj.order.type;
    var new_type = old_type.replace(old_type.charAt(0),old_type.charAt(0).toUpperCase());
    var tx = remote.buildOfferCreateTx({type: new_type,
        source: orderObj.address, taker_pays: taker_pays, taker_gets: taker_gets});
    tx.setSecret(orderObj.secret);
    if(orderObj.sequence)
        tx.setSequence(orderObj.sequence);
    tx.submit(function (err, result) {
        if (err) {
            var error = {};
            if(err.msg) error = err;
            else error.msg = err;
            respond.transactionError(res, error);
        }else{
            var _ret = {};
            _ret.success = (result.engine_result === 'tesSUCCESS' || result.engine_result === 'terPRE_SEQ');
            _ret.hash = result.tx_json.hash;
            _ret.result = result.engine_result;
            _ret.fee = Number(result.tx_json.Fee/1000000);
            _ret.sequence = result.tx_json.Sequence;
            respond.success(res, _ret);
        }
    });
}
function cancelOrder(req, res, callback) {
    if (!remote || !remote.isConnected()) {
        logger.error(resultCode.N_REMOTE.msg);
        return callback(new NetworkError(resultCode.N_REMOTE));
    }

    var orderObj = {};
    orderObj.address = req.params.address;
    orderObj.sequence = req.params.order;
    orderObj.secret  = req.body.secret;
    orderObj.seq = req.body.sequence;
    if( !jutils.isValidAddress(orderObj.address)){
        return callback(new ClientError(resultCode.C_ADDRESS));
    }
    if( !jutils.isValidSecret(orderObj.secret)){
        return callback(new ClientError(resultCode.C_SECRET));
    }
    if(isNaN(orderObj.sequence)){
        return callback(new ClientError(resultCode.C_ORDER_SEQ));
    }
    if (orderObj.seq && !/^\+?[1-9][0-9]*$/.test(orderObj.seq)) {//正整数
        return callback(new ClientError(resultCode.C_SEQUENCE));
    }

    var tx = remote.buildOfferCancelTx({source: orderObj.address, sequence: orderObj.sequence});
    tx.setSecret(orderObj.secret);
    if(orderObj.seq)
        tx.setSequence(orderObj.seq);
    tx.submit(function (err, result) {
        if (err) {
            console.log('order result err', err);
            var error = {};
            if(err.msg) error = err;
            else error.msg = err;
            logger.error('fail to cancel order: ' + err);
            respond.transactionError(res, error);
        }else{
            console.log('order result ', result);
            var _ret = {};
            _ret.success = (result.engine_result === 'tesSUCCESS' ||  result.engine_result === 'terPRE_SEQ');
            _ret.hash = result.tx_json.hash;
            _ret.result = result.engine_result;
            _ret.fee = Number(result.tx_json.Fee/1000000);
            _ret.sequence = result.tx_json.Sequence;
            respond.success(res,_ret);
        }
    });
}
function getOrders(req, res, callback) {
    if (!remote || !remote.isConnected()) {
        logger.error(resultCode.N_REMOTE.msg);
        return callback(new NetworkError(resultCode.N_REMOTE));
    }

    var address = req.params.address;
    var per_page = req.query.results_per_page || LIMIT;
    var page = req.query.page || 1;
    var marker = req.query.marker;
    if(!address || !jutils.isValidAddress(address)){
        return callback(new ClientError(resultCode.C_ADDRESS));
    }
    if(per_page && isNaN(per_page) || (per_page && per_page <= 0)){
        return callback(new ClientError(resultCode.C_PER_PAGE));
    }
    if(page && isNaN(page) || (page && page <= 0)){
        return callback(new ClientError(resultCode.C_PAGE));
    }
    if(per_page && Number(per_page)*Number(page) < 10){//per_page*page最少为10
        return callback(new ClientError(resultCode.C_ORDERS_LIMIT));
    }
    if(marker && !jutils.isValidHash(marker)){
        return callback(new ClientError(resultCode.C_MARKER_HASH));
    }

    var options = {account: address,limit: per_page * page, ledger: 'closed'};
    if (marker) {
        options.marker = marker;
    }
    var tx = remote.requestAccountOffers(options);
    tx.submit(function (err, result) {
        if(err) {
            var error = {};
            if(err.msg) error = err;
            else error.msg = err;
            logger.error('fail to get orders: ' + err);
            respond.transactionError(res, error);
        }else{
            var _ret = {};
            _ret.success = true;
            _ret.marker = '';
            _ret.orders = [];
            if(result.offers && result.offers.length > 0){
                var data = result.offers.slice(per_page * (page-1), result.offers.length);
                for(var i = 0; i< data.length;i++){
                    var offer = data[i];
                    var order = {};
                    if(typeof offer.taker_gets !== 'object'){
                        var g_value = (Number(offer.taker_gets)/1000000).toFixed(6);
                        offer.taker_gets = {};
                        offer.taker_gets.value = g_value;
                        offer.taker_gets.currency = CURRENCY;
                        offer.taker_gets.issuer = '';
                    }
                    if(typeof offer.taker_pays !== 'object'){
                        var p_value = (Number(offer.taker_pays)/1000000).toFixed(6);
                        offer.taker_pays = {};
                        offer.taker_pays.value = p_value;
                        offer.taker_pays.currency = CURRENCY;
                        offer.taker_pays.issuer = '';
                    }
                    order.type = offer.flags === 131072 ? 'sell' : 'buy';
                    utils.taker2pairs(offer, order, order.type);
                    order.sequence = offer.seq;
                    _ret.orders.push(order);
                }
                _ret.marker = result.marker;
            }else{
                _ret.orders = [];
            }
            respond.success(res, _ret);
        }
    });
}
function getTxs(options,callback) {
    var tx = remote.requestAccountOffers(options);
    tx.submit(function (err, result) {
        if(err) {
            callback(err)
        }else{
            if(result.offers && result.offers.length > 0){
                for(var i = 0; i< result.offers.length;i++){
                    var offer = result.offers[i];
                    var order = {};
                    if(typeof offer.taker_gets !== 'object'){
                        var g_value = (Number(offer.taker_gets)/1000000).toFixed(6);
                        offer.taker_gets = {};
                        offer.taker_gets.value = g_value;
                        offer.taker_gets.currency = CURRENCY;
                        offer.taker_gets.issuer = '';
                    }
                    if(typeof offer.taker_pays !== 'object'){
                        var p_value = (Number(offer.taker_pays)/1000000).toFixed(6);
                        offer.taker_pays = {};
                        offer.taker_pays.value = p_value;
                        offer.taker_pays.currency = CURRENCY;
                        offer.taker_pays.issuer = '';
                    }
                    order.type = offer.flags === 131072 ? 'sell' : 'buy';
                    utils.taker2pairs(offer, order, order.type);
                    order.sequence = offer.seq;
                    options.orders.push(order);
                }
            }
            if(!result.marker){
                callback(null, options.orders);
            }else{
                options = {account: options.account, marker:result.marker, ledger: 'closed', orders:options.orders};
                getTxs(options,callback);
            }
        }
    });
}
function getOrders2(req, res, callback) { //一次性获得用户所有挂单
    if (!remote || !remote.isConnected()) {
        logger.error(resultCode.N_REMOTE.msg);
        return callback(new NetworkError(resultCode.N_REMOTE));
    }

    var address = req.params.address;
    var pair = req.query.pair;
    if(!address || !jutils.isValidAddress(address)){
        return callback(new ClientError(resultCode.C_ADDRESS));
    }
    if(pair && !pair.indexOf('/')){
        return callback(new ClientError(resultCode.C_ORDER_PAIR));
    }
    if(pair){
        var pairs = pair.split('/');
        if(pairs.length <= 1)
            return callback(new ClientError(resultCode.C_ORDER_PAIR));
        var base = pairs[0].split(':');
        var counter = pairs[1].split(':');

        if(base[1] && base[1] !== ISSUER){
            return callback(new ClientError(resultCode.C_ORDER_ISSUER))
        }
        if(counter[1] && counter[1] !== ISSUER){
            return callback(new ClientError(resultCode.C_ORDER_ISSUER))
        }

        if(base[0] !== CURRENCY && (base.length <= 1 || base[1] === '')){
            return callback(new ClientError(resultCode.C_ORDER_PAIR_BASE));
        }
        if(counter[0] !== CURRENCY && (counter.length <= 1 || counter[1] === '')){
            return callback(new ClientError(resultCode.C_ORDER_PAIR_COUNTER));
        }

        pair = base[0] + (base[0] === CURRENCY ? '' : (':' + base[1])) + '/' + counter[0] + (counter[0] === CURRENCY ? '' : (':' + counter[1]));
    }

    var options = {account: address, ledger: 'closed', orders: []};
    getTxs(options,function (err, result) {
        if(err){
            var error = {};
            if(err.msg) error = err;
            else error.msg = err;
            logger.error('fail to get orders: ' + err);
            respond.transactionError(res, error);
        }else{
            var _ret = {};
            _ret.success = true;
            _ret.orders = [];
            if(pair){
                for(var i = 0; i < result.length; i++){
                    if(result[i].pair === pair){
                        _ret.orders.push(result[i]);
                    }
                }
            }else{
                _ret.orders = result;
            }

            respond.success(res, _ret);
        }
    });


}
function getOrder(req, res, callback) {
    if (!remote || !remote.isConnected()) {
        logger.error(resultCode.N_REMOTE.msg);
        return callback(new NetworkError(resultCode.N_REMOTE));
    }

    var address = req.params.address;
    var hash = req.params.hash;
    if(!address || !jutils.isValidAddress(address)){
        return callback(new ClientError(resultCode.C_ADDRESS));
    }
    if(!hash || !jutils.isValidHash(hash)){
        return callback(new ClientError(resultCode.C_HASH));
    }

    var tx = remote.requestTx({hash:hash});
    tx.submit(function (err, result) {
        if(err) {
            var error = {};
            if(err.msg) error = err;
            else error.msg = err;
            logger.error('fail to get order: ' + err);
            respond.transactionError(res, error);
        }else{
            if(result.TransactionType !== 'OfferCreate')
                return respond.transactionError(res, resultCode.C_NOT_ORDER);
            if(address !== result.Account)
                return respond.transactionError(res, resultCode.C_TX_ACCOUNT);
            var _ret = jutils.processTx(result, address);
            utils.taker2pairs(_ret,_ret,_ret.offertype);
            utils.taker2pairs(_ret.effects[0], _ret.effects[0], _ret.offertype);
            _ret.order  = {};
            _ret.order.account = address;
            _ret.order.pair = _ret.pair;
            _ret.order.amount = _ret.amount;
            _ret.order.price = _ret.price;
            _ret.order.type = _ret.offertype;
            _ret.order.sequence = _ret.seq;
            _ret.action = _ret.offertype;

            var ret = {};
            ret.hash = _ret.hash;
            ret.fee = _ret.fee;
            ret.action = _ret.offertype;
            ret.order = {};
            ret.order.account = address;
            ret.order.pair = _ret.pair;
            ret.order.amount = _ret.amount;
            ret.order.price = _ret.price;
            ret.order.type = _ret.offertype;
            ret.order.sequence = _ret.seq;

            respond.success(res, ret);
        }
    });
}
function getOrderBook(req, res, callback) {
    if (!remote || !remote.isConnected()) {
        logger.error(resultCode.N_REMOTE.msg);
        return callback(new NetworkError(resultCode.N_REMOTE));
    }

    var base = req.params.base;
    var counter = req.params.counter;
    var gets = {}, pays = {};
    var per_page = req.query.results_per_page || LIMIT;
    var page = req.query.page || 1;
    validateParams(base, counter, gets, pays, per_page, page, callback);

    async.parallel([function (done) {
        loadOrderBook(remote, gets, pays, per_page * page, done);
    }, function (done) {
        loadOrderBook(remote, pays, gets, per_page * page, done);
    }], function (err, results) {
        if (err) {
            var error = {};
            if(err.msg) error = err;
            else error.msg = err;
            logger.error('fail to get orders: ' + err);
            respond.transactionError(res, error);
        }

        var _ret = {};
        _ret.success = true;
        _ret.pair = (base.split('+')[0] === CURRENCY ? base.split('+')[0] : base)  + '/' + (counter.split('+')[0] === CURRENCY ? counter.split('+')[0] : counter );
        _ret.bids = [];
        _ret.asks = [];
        if(results[0].offers && results[0].offers.length > 0 || results[1].offers && results[1].offers.length > 0){
            results[0].offers = results[0].offers.slice(per_page * (page-1), results[0].offers.length);
            results[1].offers = results[1].offers.slice(per_page * (page-1), results[1].offers.length);

            var bids = parseOrderBook(results[0].offers);//买单
            bids = process_orderbook_item(bids, false);
            bids.sort(sortbids);

            var asks = parseOrderBook(results[1].offers);//卖单
            asks = process_orderbook_item(asks, true);
            asks.sort(sortAsks);
            _ret.bids =  bids;
            _ret.asks = asks;
        }

        respond.success(res, _ret);
    });
}
function getBids(req, res, callback) {//获得市场买单
    if (!remote || !remote.isConnected()) {
        logger.error(resultCode.N_REMOTE.msg);
        return callback(new NetworkError(resultCode.N_REMOTE));
    }

    var base = req.params.base;
    var counter = req.params.counter;
    var gets = {}, pays = {};
    var per_page = req.query.results_per_page || LIMIT;
    var page = req.query.page || 1;
    validateParams(base, counter, gets, pays, per_page, page, callback);

    loadOrderBook(remote, gets, pays, per_page * page, function (err, result) {
        if (err) {
            var error = {};
            if(err.msg) error = err;
            else error.msg = err;
            logger.error('fail to get bids: ' + err);
            respond.transactionError(res, error);
        }else{
            var _ret = {};
            _ret.success = true;
            _ret.pair = (base.split('+')[0] === CURRENCY ? base.split('+')[0] : base)  + '/' + (counter.split('+')[0] === CURRENCY ? counter.split('+')[0] : counter );
            _ret.bids = [];
            if(result.offers && result.offers.length > 0){
                var data = result.offers.slice(per_page * (page-1), result.offers.length);
                var bids = parseOrderBook(data);//买单
                bids = process_orderbook_item(bids, false);
                bids.sort(sortbids);
                _ret.bids =  bids;
            }
            respond.success(res, _ret);
        }
    });
}
function getAsks(req, res, callback) {//获得市场卖单
    if (!remote || !remote.isConnected()) {
        logger.error(resultCode.N_REMOTE.msg);
        return callback(new NetworkError(resultCode.N_REMOTE));
    }

    var base = req.params.base;
    var counter = req.params.counter;
    var gets = {}, pays = {};
    var per_page = req.query.results_per_page || LIMIT;
    var page = req.query.page || 1;
    validateParams(base, counter, gets, pays, per_page, page, callback);

    loadOrderBook(remote, pays, gets, per_page * page, function (err, result) {
        if (err) {
            var error = {};
            if(err.msg) error = err;
            else error.msg = err;
            logger.error('fail to get asks: ' + err);
            respond.transactionError(res, error);
        }else{
            var _ret = {};
            _ret.success = true;
            _ret.pair = (base.split('+')[0] === CURRENCY ? base.split('+')[0] : base)  + '/' + (counter.split('+')[0] === CURRENCY ? counter.split('+')[0] : counter );
            _ret.asks = [];
            if(result.offers && result.offers.length > 0){
                var data = result.offers.slice(per_page * (page-1), result.offers.length);
                var asks = parseOrderBook(data);//卖单
                asks = process_orderbook_item(asks, true);
                asks.sort(sortAsks);
                _ret.asks =  asks;
            }
            respond.success(res, _ret);
        }
    });
}
function process_orderbook_item(items, sell) {
    var newItems = [];
    for (var i = 0; i < items.length; ++i) {
        var item = items[i];
        if (item.sell && sell) {
            item.price = Number(item.price.value.substr(0, item.price.value.indexOf('.') + 9));  // 卖(ask, true) 进最后一位
            item.funded = parseFloat(item.taker_gets_funded.value);
            newItems.push(item);
        } else if(!item.sell && !sell){
            item.price = Number(item.price.value.substr(0, item.price.value.indexOf('.') + 9));// 买(bid, flase) 舍最后一位
            item.funded = parseFloat(item.taker_pays_funded.value);
            newItems.push(item);
        }
        delete item.taker_pays_funded;
        delete item.taker_gets_funded;
    }
    return newItems;
}
function sortAsks(a, b){
    return a.price - b.price;
}
function sortbids(a, b){
    return b.price - a.price;
}
function loadOrderBook(remote, base, counter, limit, callback) {
    var options = {gets: base, pays: counter, limit: limit};
    var _request = remote.requestOrderBook(options);
    _request.submit(callback);
}
function parseOrderBook(offers) {
    var orderbook = [];
    for(var i = 0; i<offers.length;i++){
        var offer = offers[i];
        var order_maker = offer.Account;
        var sequence = offer.Sequence;
        var passive = offer.Flags === 0x00010000;
        var sell = offer.Flags === 0x00020000;
        var taker_gets_total = jutils.parseAmount(offer.TakerGets);
        var taker_pays_total = jutils.parseAmount(offer.TakerPays);

        if (sell) {
            price = {
                currency: taker_pays_total.currency,
                issuer: taker_pays_total.issuer,
                value: new bignumber(taker_pays_total.value).dividedBy(taker_gets_total.value)
            };
        } else {
            price = {
                currency: taker_gets_total.currency,
                issuer: taker_gets_total.issuer,
                value: new bignumber(taker_gets_total.value).dividedBy(taker_pays_total.value)
            };
        }

        price.value = price.value.toString();
        orderbook.push({
            price: price,
            taker_gets_funded: taker_gets_total,
            taker_pays_funded: taker_pays_total,
            order_maker: order_maker,
            sequence: sequence,
            passive: passive,
            sell: sell
        });
    }
     return orderbook;
}
function validateParams(base, counter, gets, pays, per_page, page, callback) {
    if(base !== CURRENCY && base.split('+').length !== 2){
        return callback(new ClientError(resultCode.C_BASE));
    }
    if(counter !== CURRENCY && counter.split('+').length !== 2){
        return callback(new ClientError(resultCode.C_COUNTER));
    }

    if(base.split('+')[0] === CURRENCY && base.split('+').length > 1){
        return callback(new ClientError(resultCode.C_ORDER_BOOK_BASE));
    }
    if(counter.split('+')[0] === CURRENCY && counter.split('+').length > 1){
        return callback(new ClientError(resultCode.C_ORDER_BOOK_COUNTER));
    }
    gets.currency = base.split('+')[0];
    gets.issuer = gets.currency === CURRENCY ? '' : base.split('+')[1];
    pays.currency = counter.split('+')[0];
    pays.issuer = pays.currency === CURRENCY ? '' :  counter.split('+')[1];

    if(!jutils.isValidCurrency(gets.currency) || !jutils.isValidCurrency(pays.currency)){
        return callback(new ClientError(resultCode.C_CURRENCY));
    }
    if((gets.issuer && !jutils.isValidAddress(gets.issuer)) || (pays.issuer && !jutils.isValidAddress(pays.issuer))){
        return callback(new ClientError(resultCode.C_ISSUER));
    }

    if(per_page && isNaN(per_page) || (per_page && per_page <= 0)){
        return callback(new ClientError(resultCode.C_PER_PAGE));
    }
    if(page && isNaN(page) || (page && page <= 0)){
        return callback(new ClientError(resultCode.C_PAGE));
    }
    if(per_page && Number(per_page)*Number(page) > 300){//per_page*page最大300
        return callback(new ClientError(resultCode.C_MARK_LIMIT));
    }
}

module.exports={
    submitOrder: submitOrder,
    cancelOrder: cancelOrder,
    getOrder: getOrder,
    getOrders: getOrders,
    getOrders2: getOrders2,
    getOrderBook: getOrderBook,
    getBids: getBids,
    getAsks:getAsks
};