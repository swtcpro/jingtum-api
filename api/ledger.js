var remote = require('../lib/remote');
var jutils = require('jingtum-lib').utils;
const respond = require('../lib/respond');
var logger  = require('../lib/logger');
const resultCode = require('../lib/resultCode');
const ClientError  = require('../lib/errors').ClientError;
const NetworkError = require('../lib/errors').NetworkError;


//获得当前账本号/hash
function getBlockNumber(req, res, callback) {
    if (!remote || !remote.isConnected()) {
        logger.error(resultCode.N_REMOTE.msg);
        return callback(new NetworkError(resultCode.N_REMOTE));
    }

    var request= remote.requestLedgerClosed();
    request.submit(function (err, result) {
        if(err){
            var error = {};
            if(err.msg) error = err;
            else error.msg = err;
            logger.error('fail to get current ledger: ' + err);
            respond.transactionError(res, error);
        }else{
            respond.success(res, result);
        }
    });
}

//获得指定账本hash获得账本信息及交易记录
function getLedgerTxs(req, res, callback) {
    if (!remote || !remote.isConnected()) {
        logger.error(resultCode.N_REMOTE.msg);
        return callback(new NetworkError(resultCode.N_REMOTE));
    }
    var hash = req.params.hash;
    if(!hash || !jutils.isValidHash(hash)){
        return callback(new ClientError(resultCode.C_HASH));
    }
    var options = {ledger_hash: hash, transactions: true};
    var request = remote.requestLedger(options);
    request.submit(function (err, result) {
        if(err) {
            var error = {};
            if(err.msg) error = err;
            else error.msg = err;
            logger.error('fail to get ledger txs by ledger_hash: ' + err);
            respond.transactionError(res, error);
        }else{
            respond.success(res, result);
        }
    });
}

//获得指定账本号获得账本信息及交易记录
function getLedgerTxs2(req, res, callback) {
    if (!remote || !remote.isConnected()) {
        logger.error(resultCode.N_REMOTE.msg);
        return callback(new NetworkError(resultCode.N_REMOTE));
    }
    var index = req.params.index;
    if(!index || index && isNaN(index)){
        return callback(new ClientError(resultCode.C_INDEX));
    }
    var options = {ledger_index: index, transactions: true};
    var request = remote.requestLedger(options);
    request.submit(function (err, result) {
        if(err) {
            var error = {};
            if(err.msg) error = err;
            else error.msg = err;
            logger.error('fail to get ledger txs by ledger_index: ' + err);
            respond.transactionError(res, error);
        }else{
            respond.success(res, result);
        }
    });
}

module.exports={
    getBlockNumber: getBlockNumber,
    getLedgerTx: getLedgerTxs,
    getLedgerTx2: getLedgerTxs2
};