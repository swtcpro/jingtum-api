var remote = require('../lib/remote');
var jutils = require('jingtum-lib').utils;
const respond = require('../lib/respond');
var logger  = require('../lib/logger');
const resultCode = require('../lib/resultCode');
const ClientError  = require('../lib/errors').ClientError;
const NetworkError = require('../lib/errors').NetworkError;
const LIMIT = 10;

function setRelations(req, res, callback) {
    if (!remote || !remote.isConnected()) {
        logger.error(resultCode.N_REMOTE.msg);
        return callback(new NetworkError(resultCode.N_REMOTE));
    }

    var type = req.body.type;
    if(!type || !/^((trust)|(authorize)|(freeze))$/.test(type)){
        return callback(new ClientError(resultCode.C_TYPE_RELATIONS));
    }

    var relationObj = {};
    relationObj.address = req.params.address;
    relationObj.secret = req.body.secret;
    var options = {};
    if(!relationObj.address || !relationObj.secret){
        return callback(new ClientError(resultCode.C_MISSING_PARAMS));
    }
    if( !jutils.isValidAddress(relationObj.address)){
        return callback(new ClientError(resultCode.C_ADDRESS));
    }
    if( !jutils.isValidSecret(relationObj.secret)){
        return callback(new ClientError(resultCode.C_SECRET));
    }
    if(req.body.amount){
        relationObj.amount = req.body.amount;
        relationObj.amount.value = relationObj.amount.limit;
        delete relationObj.amount.limit;
    }
    if(type === 'trust'){//信任
        if(!relationObj.amount || !jutils.isValidAmount(relationObj.amount)){
            return callback(new ClientError(resultCode.C_RELATION_AMOUNT));
        }
        options = {account: relationObj.address, limit: relationObj.amount ,type:'trust'};
    }else if(type === 'authorize' || type === 'freeze'){//授权、冻结
        relationObj.counterparty = req.body.counterparty;
        if( !jutils.isValidAddress(relationObj.counterparty)){
            return callback(new ClientError(resultCode.C_COUNTERPARTY));
        }
        if(!relationObj.amount || !jutils.isValidAmount(relationObj.amount)){
            return callback(new ClientError(resultCode.C_RELATION_AMOUNT));
        }
        options = {account: relationObj.address, target: relationObj.counterparty, limit: relationObj.amount ,type: type};
    }
    var tx = remote.buildRelationTx(options);
    tx.setSecret(relationObj.secret);
    tx.submit(function (err, result) {
        if (err) {
            var error = {};
            if(err.msg) error = err;
            else error.msg = err;
            respond.transactionError(res, error);
        }else{
            var _ret = {};
            _ret.success = result.engine_result === 'tesSUCCESS';
            _ret.hash = result.tx_json.hash;
            _ret.result = result.engine_result;
            _ret.fee = Number(result.tx_json.Fee/1000000);
            _ret.sequence = result.tx_json.Sequence;
            respond.success(res, _ret);
        }
    });
}
function delFreeze(req, res, callback) {
    if (!remote || !remote.isConnected()) {
        logger.error(resultCode.N_REMOTE.msg);
        return callback(new NetworkError(resultCode.N_REMOTE));
    }

    var type = req.body.type;
    if(!type || !/^(unfreeze)$/.test(type)){
        return callback(new ClientError(resultCode.C_FREEZE_RELATIONS));
    }

    var relationObj = {};
    relationObj.address = req.params.address;
    relationObj.secret = req.body.secret;

    if(!relationObj.address || !relationObj.secret){
        return callback(new ClientError(resultCode.C_MISSING_PARAMS));
    }
    if( !jutils.isValidAddress(relationObj.address)){
        return callback(new ClientError(resultCode.C_ADDRESS));
    }
    if( !jutils.isValidSecret(relationObj.secret)){
        return callback(new ClientError(resultCode.C_SECRET));
    }
    if(req.body.amount){
        relationObj.amount = req.body.amount;
        relationObj.amount.value = relationObj.amount.limit;
        delete relationObj.amount.limit;
    }

    relationObj.counterparty = req.body.counterparty;
    if( !jutils.isValidAddress(relationObj.counterparty)){
        return callback(new ClientError(resultCode.C_COUNTERPARTY));
    }
    if(!relationObj.amount || !jutils.isValidAmount(relationObj.amount)){
        return callback(new ClientError(resultCode.C_RELATION_AMOUNT));
    }
    var options = {account: relationObj.address, target: relationObj.counterparty, limit: relationObj.amount ,type: 'unfreeze'};

    var tx = remote.buildRelationTx(options);
    tx.setSecret(relationObj.secret);
    tx.submit(function (err, result) {
        if (err) {
            var error = {};
            if(err.msg) error = err;
            else error.msg = err;
            logger.error('fail to unfreeze: ' + err);
            respond.transactionError(res, error);
        }else{
            var _ret = {};
            _ret.success = result.engine_result === 'tesSUCCESS';
            _ret.hash = result.tx_json.hash;
            _ret.result = result.engine_result;
            _ret.fee = Number(result.tx_json.Fee/1000000);
            _ret.sequence = result.tx_json.Sequence;
            respond.success(res,_ret);
        }
    });
}
function getRelations(req, res, callback) {
    if (!remote || !remote.isConnected()) {
        logger.error(resultCode.N_REMOTE.msg);
        return callback(new NetworkError(resultCode.N_REMOTE));
    }

    var address = req.params.address;
    var type = req.query.type;
    var per_page = req.query.results_per_page || LIMIT;
    var page = req.query.page || 1;
    var marker = req.query.marker;
    if(!address || !jutils.isValidAddress(address)){
        return callback(new ClientError(resultCode.C_ADDRESS));
    }
    if(!type || !/^((trust)|(authorize)|(freeze))$/.test(type)){
        return callback(new ClientError(resultCode.C_TYPE_RELATIONS));
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
    var options = {account: address, type: type,limit: per_page * page};
    if (marker) {
        options.marker = marker;
    }

    var tx = remote.requestAccountRelations(options);
    tx.submit(function (err, result) {
        if(err) {
            var error = {};
            if(err.msg) error = err;
            else error.msg = err;
            logger.error('fail to get relations: ' + err);
            respond.transactionError(res, error);
        }else{
            var ret = {};
            if(result.marker) ret.marker = result.marker;
            ret.relations = [];
            if(result.lines && result.lines.length > 0){
                var data = result.lines.slice(per_page * (page-1), result.lines.length);
                for(var i = 0; i < data.length; i++){
                    var item = data[i];
                    var _item = {};
                    if(type === 'trust'){
                        _item = {
                            issuer: item.account,
                            type : 'trust',
                            balance: item.balance,
                            limit: item.limit,
                            currency: item.currency,
                            quality_out: item.quality_out,
                            quality_in: item.quality_in
                        };
                    } else if(type === 'authorize'){
                        _item = {
                            account: result.account,
                            type : 'authorize',
                            counterparty: item.limit_peer,
                            amount: {
                                limit: item.limit,
                                currency: item.currency,
                                issuer: item.issuer
                            }
                        };
                    }else if(type === 'freeze'){
                        _item = {
                            account: result.account,
                            type : 'freeze',
                            counterparty: item.limit_peer,
                            amount: {
                                limit: item.limit,
                                currency: item.currency,
                                issuer: item.issuer
                            }
                        };
                    }
                    ret.relations.push(_item);
                }
            }
            respond.success(res, ret);
        }
    });
}


module.exports = {
    getRelations: getRelations,
    setRelations: setRelations,
    delFreeze: delFreeze
};