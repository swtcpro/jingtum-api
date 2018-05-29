var remote = require('../lib/remote');
var jutils = require('jingtum-lib').utils;
var utils  = require('../lib/utils');
const respond = require('../lib/respond');
var logger  = require('../lib/logger');
const resultCode = require('../lib/resultCode');
const ClientError  = require('../lib/errors').ClientError;
const NetworkError = require('../lib/errors').NetworkError;
const LIMIT = 10;

function getTransaction(req, res, callback) {
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
    var options = {account: address, type: 'trust'};
    var tx1 = remote.requestAccountInfo(options);
    tx1.submit(function (err, result) {
        if(err === 'Account not found.'){
            return callback(new ClientError(resultCode.C_ACCOUNT_NOT_FOUND));
        }else{
            var tx = remote.requestTx({hash:hash});
            tx.submit(function (err, result) {
                if(err) {
                    var error = {};
                    if(err.msg) error = err;
                    else error.msg = err;
                    logger.error('fail to get tx: ' + err);
                    respond.transactionError(res, error);
                }else{
                    // if(address !== result.Account)
                    //     return respond.transactionError(res, resultCode.C_TX_ACCOUNT);
                    var _ret = jutils.processTx(result, address);
                    if(_ret.type === 'offereffect' && _ret.effects.length === 0){
                        var error1 = {};
                        error1.msg = 'The hash is not belong to this address.';
                        logger.error('fail to get tx: hash is not belong to this address');
                        respond.transactionError(res, error1);
                        return;
                    }
                    if(_ret.gets){
                        utils.taker2pairs(_ret,_ret,_ret.offertype);
                        delete _ret.gets;
                        delete _ret.pays;
                    }

                    if(JSON.stringify(_ret.memos) !== '[]'){
                        var m = [];
                        for(var q = 0;q < _ret.memos.length; q++){
                            m.push(_ret.memos[q].MemoData);
                        }
                        _ret.memos = m;
                    }

                    for(var j = 0;j < _ret.effects.length; j++){
                        var e = _ret.effects[j];
                        if(e.got || e.gets){
                            utils.taker2pairs(e, e, e.type);
                            delete e.gets;
                            delete e.pays;
                            //delete e.got;
                            //delete e.paid;
                        }
                    }
                    _ret.ledger = result.inLedger;
                    var _data = {transaction:_ret};
                    respond.success(res, _data);
                }
            });
        }
    });


}

function getTransaction2(req, res, callback) {
    if (!remote || !remote.isConnected()) {
        logger.error(resultCode.N_REMOTE.msg);
        return callback(new NetworkError(resultCode.N_REMOTE));
    }

    var hash = req.params.hash;
    if (!hash || !jutils.isValidHash(hash)) {
        return callback(new ClientError(resultCode.C_HASH));
    }

    var tx = remote.requestTx({hash: hash});
    tx.submit(function (err, result) {
        if (err) {
            var error = {};
            if (err.msg) error = err;
            else error.msg = err;
            logger.error('fail to get tx: ' + err);
            respond.transactionError(res, error);
        } else {
            var _ret = jutils.processTx(result, result.Account);
            _ret.account = result.Account;
            _ret.ledger = result.inLedger;
            if (_ret.gets) {
                utils.taker2pairs(_ret, _ret, _ret.offertype);
                delete _ret.gets;
                delete _ret.pays;
            }

            if (JSON.stringify(_ret.memos) !== '[]') {
                var m = [];
                for (var q = 0; q < _ret.memos.length; q++) {
                    m.push(_ret.memos[q].MemoData);
                }
                _ret.memos = m;
            }

            for (var j = 0; j < _ret.effects.length; j++) {
                var e = _ret.effects[j];
                if (e.got || e.gets) {
                    utils.taker2pairs(e, e, e.type);
                    delete e.gets;
                    delete e.pays;
                    //delete e.got;
                    //delete e.paid;
                }
            }
            var _data = {transaction: _ret};
            respond.success(res, _data);
        }
    });
}

function getTransactionList(req, res, callback) {
    if (!remote || !remote.isConnected()) {
        logger.error(resultCode.N_REMOTE.msg);
        return callback(new NetworkError(resultCode.N_REMOTE));
    }
    var address = req.params.address;
    var per_page = req.query.results_per_page || LIMIT;
    var page = req.query.page || 1;
    var forward = req.query.forward;
    var currency = req.query.currency;
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
    if(per_page && Number(per_page)*Number(page) > 200){//per_page*page最大200
        return callback(new ClientError(resultCode.C_TXS_LIMIT));
    }
    if(forward && !/asc|desc/.test(forward)){
        return callback(new ClientError(resultCode.C_FORWARD));
    }
    if(currency && !jutils.isValidCurrency(currency)){
        return callback(new ClientError(resultCode.C_CURRENCY));
    }
    var options = {account: address, limit: per_page * page};
    if (marker) {
        options.marker = eval("("+ marker +")");
    }
    if(forward === 'asc'){
        options.forward = true;
    }else if(forward === 'desc'){
        options.forward = false;
    }
    logger.info('tx options in get txs:', options);
    var tx = remote.requestAccountTx(options);
    tx.submit(function (err, result) {
        if(err) {
            var error = {};
            if(err.msg) error = err;
            else error.msg = err;
            logger.error('fail to get txs: ' + err);
            respond.transactionError(res, error);
        }else{
            var _ret = {};
            _ret.marker = {};
            _ret.transactions = [];
            if(result.transactions && result.transactions.length > 0) {
                var data = result.transactions.slice(per_page * (page - 1), result.transactions.length);
                for(var i = 0; i < data.length;i++){
                    var tr = data[i];
                    if(currency && tr.amount && tr.amount.currency !== currency){
                        continue;
                    }
                    if(JSON.stringify(tr.memos) !== '[]'){
                        var m = [];
                        for(var q = 0;q < tr.memos.length; q++){
                            m.push(tr.memos[q].MemoData);
                        }
                        tr.memos = m;
                    }

                    if(tr.gets){
                        if(currency && !(tr.gets.currency === currency || tr.pays.currency === currency)){
                            continue;
                        }
                        utils.taker2pairs(tr,tr,tr.offertype);
                        delete tr.gets;
                        delete tr.pays;
                    }
                    var flag = 0;
                    for(var j = 0;j < tr.effects.length; j++){
                        var e = tr.effects[j];
                        if(e.got || e.gets){
                            if(currency && !(e.gets && e.gets.currency === currency || e.pays && e.pays.currency === currency || e.got && e.got.currency === currency || e.paid && e.paid.currency === currency)){
                                flag = 1;
                            }
                            utils.taker2pairs(e, e, e.type);
                            delete e.gets;
                            delete e.pays;
                            //delete e.got;
                            //delete e.paid;
                        }
                    }
                    if(flag || tr.type === 'offercancel' && tr.effects.length === 0) {//当type=offercancel && effects.length===0时，是再次取消了已经取消的单子，属于无效交易，过滤掉。
                        continue;
                    }
                    _ret.transactions.push(tr);
                }
                _ret.marker = result.marker;
                // _ret.transactions = data;
            }
            if(!result.marker){
                delete  _ret.marker;
            }
            respond.success(res, _ret);
        }
    });
}

module.exports={
    getTx: getTransaction,
    getTx2: getTransaction2,
    getTxs: getTransactionList
};