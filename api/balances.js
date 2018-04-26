/**
 * Created by wudan on 2017/7/25.
 */

var remote = require('../lib/remote');
var async  = require('async');
var logger  = require('../lib/logger');
var config  = require('../lib/config');
var jutils = require('jingtum-lib').utils;
const respond = require('../lib/respond');
const resultCode = require('../lib/resultCode');
const ClientError  = require('../lib/errors').ClientError;
const NetworkError = require('../lib/errors').NetworkError;
const CURRENCY = config.get('base_currency') || 'SWT';

function getBalance(req, res, callback) {
    var address = req.params.account;
    if(!address || !jutils.isValidAddress(address)){
        return callback(new ClientError(resultCode.C_ADDRESS));
    }
    if (!remote || !remote.isConnected()) {
        logger.error(resultCode.N_REMOTE.msg);
        return callback(new NetworkError(resultCode.N_REMOTE));
    }
    var condition = {};
    if(req.query.currency){
        if(!jutils.isValidCurrency(req.query.currency)){
            return callback(new ClientError(resultCode.C_CURRENCY));
        }
        condition.currency = req.query.currency;
    }
    if(req.query.issuer){
        if(!jutils.isValidAddress(req.query.issuer)){
            return callback(new ClientError(resultCode.C_ISSUER));
        }
        condition.issuer = req.query.issuer;
    }

    var options = {account: address, type: 'trust'};
    var options2 = {account: address, type: 'freeze'};
    async.parallel({
        native: function (callback) {
            var req1 = remote.requestAccountInfo(options);
            req1.submit(callback);
        },
        lines: function (callback) {
            var req2 = remote.requestAccountRelations(options);
            req2.submit(callback);
        },
        lines2: function (callback) { //关系中设置的冻结
            var req2 = remote.requestAccountRelations(options2);
            req2.submit(callback);
        },
        orders: function (callback) {
            var offers = [];
            function getOffers() {
                var req3 = remote.requestAccountOffers(options);
                req3.submit(function (err, result) {
                    if(err){callback(err)}
                    else if(result.marker){
                        offers = offers.concat(result.offers);
                        options = {account: address, marker:result.marker};
                        getOffers(options);
                    }else{
                        offers = offers.concat(result.offers);
                        result.offers = offers;
                        callback(null, result);
                    }
                });
            }
            getOffers(options);
        }

    }, function (err, results) {
        if (err) {
            var error = {};
            if(err.msg){
                error = err;
            }else{
                error.msg = err;
            }
            logger.error('fail to get balance: ' + err);
            respond.transactionError(res, error);
        }else{
            respond.success(res,process_balance(results,condition));
        }
    });
}

function process_balance(data,condition) {
    var swt_value = new Number(data.native.account_data.Balance) / 1000000.0;
    var freeze0 = config.get('freezed').reserved
        + (data.lines.lines.length + data.orders.offers.length) * config.get('freezed').each_freezed;
    var swt_data = {value: swt_value + '', currency: CURRENCY, issuer: '', freezed: freeze0 + ''};
    var _data = [];
    if((!condition.currency && !condition.issuer) || condition.currency && condition.currency === CURRENCY){
        _data.push(swt_data);
    }

    for (var i = 0; i < data.lines.lines.length; ++i) {
        if(condition.currency && condition.currency === CURRENCY){
            break;
        }
        var item = data.lines.lines[i];
        var tmpBal = {value: item.balance, currency: item.currency, issuer: item.account, freezed: '0'};
        var freezed = 0;
        data.orders.offers.forEach(function (off) {
            var taker_gets = jutils.parseAmount(off.taker_gets);
            if (taker_gets.currency === swt_data.currency && taker_gets.issuer === swt_data.issuer) {
                var tmpFreezed = parseFloat(swt_data.freezed) + parseFloat(taker_gets.value);
                swt_data.freezed = tmpFreezed + '';
            } else if (taker_gets.currency === tmpBal.currency && taker_gets.issuer === tmpBal.issuer) {
                freezed += parseFloat(taker_gets.value);
            }
        });
        for(var j = 0; j < data.lines2.lines.length; j++){
            var l =  data.lines2.lines[j];
            if(l.currency === tmpBal.currency && l.issuer === tmpBal.issuer){
                freezed += parseFloat(l.limit);
            }
        }

        tmpBal.freezed = parseFloat(tmpBal.freezed) + freezed;
        tmpBal.freezed = tmpBal.freezed.toFixed(6) + '';
        if(condition.currency && (condition.currency !== tmpBal.currency)){
            continue;
        }
        if(condition.issuer && (condition.issuer !== tmpBal.issuer)){
            continue;
        }

        _data.push(tmpBal);
    }

    var _ret = {
        "balances": _data,
        "sequence": data.native.account_data.Sequence
    };
    return _ret;
}

module.exports = {
    getBalance: getBalance
};