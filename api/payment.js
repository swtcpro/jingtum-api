var remote = require('../lib/remote');
var jutils = require('jingtum-lib').utils;
var utils  = require('../lib/utils');
const respond = require('../lib/respond');
var logger  = require('../lib/logger');
var async = require('async');
var db = require('../lib/db');
const resultCode = require('../lib/resultCode');
const ClientError  = require('../lib/errors').ClientError;
const NetworkError = require('../lib/errors').NetworkError;
const LIMIT = 10;

function getPaymentChoices(req, res, callback) {
    if (!remote || !remote.isConnected()) {
        logger.error(resultCode.N_REMOTE);
        return callback(new NetworkError(resultCode.N_REMOTE));
    }

    var source = req.params.source_address;
    var destination = req.params.destination_address;
    var amount = req.params.amount;
    if(!source || !jutils.isValidAddress(source)){
        return callback(new ClientError(resultCode.C_ADDRESS));
    }
    if(!destination || !jutils.isValidAddress(destination)){
        return callback(new ClientError(resultCode.C_ROUTER_DESTINATION));
    }
    if(!amount || !utils.isStrAmount(amount)){
        return callback(new ClientError(resultCode.C_STR_AMOUNT));
    }

    var pathfindParams = {
        account: source,
        destination: destination,
        amount: utils.str2Amount(amount)
    };
    var requst = remote.requestPathFind(pathfindParams);
    requst.submit(function (err, result) {
        if(err) {
            var error = {};
            if(err.msg) error = err;
            else error.msg = err;
            logger.error('fail to get choices: ' + err);
            respond.transactionError(res, error);
        }else{
            var _ret = {
                "choices": result
            };
            respond.success(res,_ret);
        }
    });
}

function submitPayment(req, res, callback) {
    if (!remote || !remote.isConnected()) {
        logger.error(resultCode.N_REMOTE.msg);
        return callback(new NetworkError(resultCode.N_REMOTE));
    }

    var paymentObj = {};
    paymentObj.secret = req.body.secret;
    paymentObj.payment = req.body.payment;
    paymentObj.client_id = req.body.client_id;
    paymentObj.sequence = req.body.sequence;
    var validated = req.query.validated;

    if(validated && !(validated === 'true' || validated === 'false')){
        return callback(new ClientError(resultCode.C_ERR_INVALID));
    }
    if( !jutils.isValidAddress(req.params.source_address)){
        return callback(new ClientError(resultCode.C_ADDRESS));
    }

    if (paymentObj.sequence && !/^\+?[1-9][0-9]*$/.test(paymentObj.sequence)) {//正整数
        return callback(new ClientError(resultCode.C_SEQUENCE));
    }
    if(!paymentObj.secret){
        return callback(new ClientError(resultCode.C_MISSING_SECRET));
    }
    if(!paymentObj.client_id){
        return callback(new ClientError(resultCode.C_MISSING_CLIENT_ID));
    }
    if(!paymentObj.payment){
        return callback(new ClientError(resultCode.C_MISSING_PAYMENT));
    }

    if( !jutils.isValidSecret(paymentObj.secret)){
        return callback(new ClientError(resultCode.C_SECRET));
    }
    if(typeof paymentObj.payment !== 'object'){
        return callback(new ClientError(resultCode.C_TYPE_PAYMENT));
    }
    if(!paymentObj.payment.source){
        return callback(new ClientError(resultCode.C_MISSING_PAYMENT_SOURCE));
    }
    if(!paymentObj.payment.destination){
        return callback(new ClientError(resultCode.C_MISSING_PAYMENT_DES));
    }
    if(!paymentObj.payment.amount){
        return callback(new ClientError(resultCode.C_MISSING_PAYMENT_AMOUNT));
    }

    if(!jutils.isValidAddress(paymentObj.payment.source)){
        return callback(new ClientError(resultCode.C_PAY_SOURCE));
    }
    if(req.params.source_address !== paymentObj.payment.source){
        return callback(new ClientError(resultCode.C_PAY_SOURCE2));
    }
    if(!jutils.isValidAddress(paymentObj.payment.destination)){
        return callback(new ClientError(resultCode.C_PAY_DESTINATION));
    }
    if(!jutils.isValidAmount(paymentObj.payment.amount)){
        return callback(new ClientError(resultCode.C_PAY_AMOUNT));
    }

    if(paymentObj.payment.memos && !(paymentObj.payment.memos instanceof Array)){
        return callback(new ClientError(resultCode.C_PAY_MEMOS));
    }
    if (paymentObj.payment.memos) {
        for (var i = 0; i < paymentObj.payment.memos.length; i++)
            if(typeof paymentObj.payment.memos[i] !== 'string'){
                logger.error('memos type error, each item\'s type in the memos is:', typeof paymentObj.payment.memos[i]);
                return callback(new ClientError(resultCode.C_PAY_MEMOS_TYPE));
            }
    }
    if(paymentObj.payment.choice && typeof paymentObj.payment.choice !== 'string'){
        return callback(new ClientError(resultCode.C_PAY_CHOICES));
    }
    if(!paymentObj.client_id){
        return callback(new ClientError(resultCode.C_PAY_CLIENT_ID));
    }

    var from = paymentObj.payment.source;
    var to = paymentObj.payment.destination;
    var amount = paymentObj.payment.amount;
    async.waterfall([
        function (callback) {//判断client_id是否重复
            db("select * from payment where client_id='" + paymentObj.client_id + "' limit 1", function (err, res) {
                if(err){
                    var error = {};
                    if(err.msg) error = err;
                    else error.msg = err;
                    callback(error);
                }
                else if(JSON.stringify(res) !== '[]'){
                   callback(resultCode.C_PAY_CLIENT_ID_EXITS);
                }else {
                    callback(null);
                }
            });
        },
        function (callback) {//查找路径
            if(paymentObj.payment.choice){
                var pathfindParams = {
                    account: from,
                    destination: to,
                    amount: amount
                };
                var requst = remote.requestPathFind(pathfindParams);
                requst.submit(function (err, choices) {
                    if(err) {
                        var error = {};
                        if(err.msg) error = err;
                        else error.msg = err;
                        callback(error);
                    }else{
                        callback(null, choices);
                    }
                });
            }
            else callback(null,null);
        },
        function (choices, callback) {//支付请求
            if(choices){
                var isValidKey = false;
                for(var j = 0;j < choices.length;j++){
                    if(choices[j].key === paymentObj.payment.choice){
                        isValidKey = true;
                        break;
                    }
                }
                if(!isValidKey)
                    return callback(resultCode.C_PAY_NOT_EXITS_CHOICE);
            }

            var tx = remote.buildPaymentTx({account: from, to: to, amount: amount});
            tx.setSecret(paymentObj.secret);
            if (paymentObj.payment.memos) {
                for (var i = 0; i < paymentObj.payment.memos.length; i++)
                    tx.addMemo(paymentObj.payment.memos[i]);
            }
            if(choices)
                tx.setPath(paymentObj.payment.choice);
            if(paymentObj.sequence){
                tx.setSequence(paymentObj.sequence);
            }
            tx.submit(function (err, result) {
                if (err) {
                    var error = {};
                    if(err.msg) error = err;
                    else error.msg = err;
                   callback(error);
                } else {
                   callback(null,result);
                }
            });
        },
        function (payment, callback) {
            if(validated === 'true'){
                var d1 = new Date();
                var a = 0;
                function getTx() {
                    setTimeout(function () {
                        var tx = remote.requestTx({hash:payment.tx_json.hash});
                        tx.submit(function (err, _tx) {
                            var d2 = new Date();
                            if (err) {
                                callback(resultCode.T_ERR_GET_TX);
                            } else if(_tx && _tx.validated && _tx.meta && _tx.meta.TransactionResult === 'tesSUCCESS'){
                                callback(null, payment);
                            }else if( d2 - d1 >= 20000){
                                callback(resultCode.T_FAIL_GET_TX);
                            }else{
                                console.log('a: ', a++);
                                getTx();
                            }
                        });
                    }, 10000);
                }
                getTx();
            }else{
                callback(null, payment);
            }
        }
    ], function (error, result) {
        if(error)
            respond.transactionError(res, error);
        else{
            var _ret = {};
            _ret.success = (result.engine_result === 'tesSUCCESS' || result.engine_result === 'terPRE_SEQ');
            _ret.client_id = paymentObj.client_id;
            _ret.hash = result.tx_json.hash;
            _ret.result = result.engine_result;
            // _ret.date = result.tx_json.Timestamp + 0x386D4380;
            _ret.fee = Number(result.tx_json.Fee / 1000000);

            var tiny = result.engine_result === 'tesSUCCESS'? 1 : 0;
            var time = new Date().getTime();
            db("insert into payment(client_id, hash, source, destination, amount, memos, choice, date, result) values('" + paymentObj.client_id + "','"+ result.tx_json.hash +"','"+ from +"','"+ to +"','"+ JSON.stringify(amount)+"','"+ JSON.stringify(paymentObj.payment.memos || []) +"','"+ (paymentObj.payment.choice || "") + "','"+ time + "','" + tiny + "')", function (err, result) {
                if(err){
                    logger.error('save payment err:',err);
                }else
                    logger.info('saved to mysql successfully!');
            });
            respond.success(res, _ret);
        }
    });
}

function getPayment(req, res, callback) {
    if (!remote || !remote.isConnected()) {
        logger.error(resultCode.N_REMOTE);
        return callback(new NetworkError(resultCode.N_REMOTE));
    }

    var address = req.params.address;
    var hash = req.params.id;
    if(!address || !jutils.isValidAddress(address)){
        return callback(new ClientError(resultCode.C_ADDRESS));
    }

    async.waterfall([
        function (callback) {//是否是hash
            if(!hash || !jutils.isValidHash(hash)){
                callback(null,false);
            }else {
                callback(null,true);
            }
        },
        //是hash，走下一步；不是hash，判断是否为client_id，是client_id把hash取出来，不是报参数错误。
        function (isHash, callback) {
            if(isHash) callback(null,null);
            else{
                db("select hash from payment where client_id='" + hash + "' limit 1", function (err, res) {
                    if(err) {
                        var error = {};
                        if(err.msg) error = err;
                        else error.msg = err;
                        callback(error);
                    }
                    else if(JSON.stringify(res) === '[]'){
                        return callback(new ClientError(resultCode.C_HASH));
                    }else{
                        var id2hash = res[0].hash;
                        callback(null,id2hash);
                    }
                });
            }
        },
        function (id2hash, callback) {
            if(id2hash) hash = id2hash;
            var tx = remote.requestTx({hash:hash});
            tx.submit(function (err, result) {
                if(err) {
                    var error = {};
                    if(err.msg) error = err;
                    else error.msg = err;
                    callback(error);
                }else{
                    if(result.TransactionType !== 'Payment')
                        callback(resultCode.C_NOT_PAY);
                    if(!(address === result.Account || address === result.Destination))
                        callback(resultCode.C_TX_ACCOUNT);
                    var _ret = jutils.processTx(result, address);
                    if(JSON.stringify(_ret.memos) !== '[]'){
                        var m = [];
                        for(var j = 0;j < _ret.memos.length; j++){
                            m.push(_ret.memos[j].MemoData);
                        }
                        _ret.memos = m;
                    }
                   callback(null, _ret);
                }
            });
        }
    ], function (err, result) {
        if(err)
            respond.transactionError(res, err);
        else{
            respond.success(res, result);
        }
    });
}

function getPayments(req, res, callback) {
    if (!remote || !remote.isConnected()) {
        logger.error(resultCode.N_REMOTE.msg);
        return callback(new NetworkError(resultCode.N_REMOTE));
    }

    var address = req.params.address;
    var per_page = req.query.results_per_page || LIMIT;
    var page = req.query.page || 1;
    var marker = req.query.marker;
    var currency = req.query.currency;
    if(!address || !jutils.isValidAddress(address)){
        return callback(new ClientError(resultCode.C_ADDRESS));
    }
    if(per_page && isNaN(per_page) || (per_page && per_page <= 0)){
        return callback(new ClientError(resultCode.C_RESULT_PER_PAGE));
    }
    if(page && isNaN(page) || (page && page <= 0)){
        return callback(new ClientError(resultCode.C_PAGE));
    }
    if(currency && !jutils.isValidCurrency(currency)){
        return callback(new ClientError(resultCode.C_CURRENCY));
    }
    var options = {account: address, limit: per_page * page};
    if (marker) {
        options.marker = eval("("+ marker +")");
    }
    var tx = remote.requestAccountTx(options);
    tx.submit(function (err, result) {
        if(err) {
            var error = {};
            if(err.msg) error = err;
            else error.msg = err;
            logger.error('fail to get payment: ' + err);
            respond.transactionError(res, error);
        }else{
            var _ret = {};
            _ret.success = true;
            _ret.marker = {};
            _ret.payments = [];
            if(result.transactions && result.transactions.length > 0) {
                var data = result.transactions.slice(per_page * (page - 1), result.transactions.length);
                for(var i = 0; i< data.length;i++){
                    var tr = data[i];
                    if(tr.type === 'received' || tr.type === 'sent'){
                        if(currency && tr.amount.currency !== currency){
                            continue;
                        }
                        if(JSON.stringify(tr.memos) !== '[]'){
                            var m = [];
                            for(var j = 0;j < tr.memos.length; j++){
                                m.push(tr.memos[j].MemoData);
                            }
                            tr.memos = m;
                        }
                        _ret.payments.push(tr);
                    }
                }
                _ret.marker = result.marker;
            }
            respond.success(res, _ret);
        }
    });
}


module.exports={
    getChoices: getPaymentChoices,
    submitPayment: submitPayment,
    getPayment: getPayment,
    getPayments: getPayments
};