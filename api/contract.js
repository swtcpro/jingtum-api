var remote = require('../lib/remote');
var jutils = require('jingtum-lib').utils;
var utils  = require('../lib/utils');
const respond = require('../lib/respond');
var logger  = require('../lib/logger');
const resultCode = require('../lib/resultCode');
const ClientError  = require('../lib/errors').ClientError;
const NetworkError = require('../lib/errors').NetworkError;

function deployContract(req, res, callback) {
    if (!remote || !remote.isConnected()) {
        logger.error(resultCode.N_REMOTE.msg);
        return callback(new NetworkError(resultCode.N_REMOTE));
    }

    var options = {};
    options.account = req.params.address;
    options.amount = req.body.amount;
    options.secret = req.body.secret;
    options.params = req.body.params;
    options.sequence = req.body.sequence;
    var payload = req.body.payload;

    if(!options.secret || !options.amount || !payload){
        return callback(new ClientError(resultCode.C_MISSING_PARAMS));
    }
    if( !jutils.isValidSecret(options.secret)){
        return callback(new ClientError(resultCode.C_SECRET));
    }
    if(!jutils.isValidAddress(options.account)){
        return callback(new ClientError(resultCode.C_ADDRESS));
    }

    if(isNaN(options.amount) || Number(options.amount) <= 0){
        return callback(new ClientError(resultCode.C_CONTRACT_AMOUNT));
    }
    if(typeof payload !== 'string'){
        return callback(new ClientError(resultCode.C_PAYLOAD));
    }
    if(options.params && !options.params instanceof Array){
        return callback(new ClientError(resultCode.C_CONTRACT_PARAMS));
    }
    if (options.sequence && !/^\+?[1-9][0-9]*$/.test(options.sequence)) {//正整数
        return callback(new ClientError(resultCode.C_SEQUENCE));
    }
    options.payload = utils.stringToHex(payload);
    var tx = remote.deployContractTx(options);
    tx.setSecret(options.secret);
    if(options.sequence)
        tx.setSequence(options.sequence);
    tx.submit(function (err, result) {
        if(err) {
            var error = {};
            if(err.msg) error = err;
            else error.msg = err;
            logger.error('fail to deploy contract: ' + err);
            respond.transactionError(res, error);
        }else{
            respond.success(res, result);
        }
    });
}
function callContract(req, res, callback) {
    if (!remote || !remote.isConnected()) {
        logger.error(resultCode.N_REMOTE.msg);
        return callback(new NetworkError(resultCode.N_REMOTE));
    }

    var options = {};
    options.account = req.params.address;
    options.secret = req.body.secret;
    options.destination = req.body.destination;
    options.params = req.body.params;
    options.foo = req.body.foo;
    options.sequence = req.body.sequence;

    if(!options.secret || !options.destination || !options.foo){
        return callback(new ClientError(resultCode.C_MISSING_PARAMS));
    }
    if( !jutils.isValidSecret(options.secret)){
        return callback(new ClientError(resultCode.C_SECRET));
    }
    if(!jutils.isValidAddress(options.account)){
        return callback(new ClientError(resultCode.C_ADDRESS));
    }
    if(!jutils.isValidAddress(options.destination)){
        return callback(new ClientError(resultCode.C_CALL_DESTINATION));
    }
    if(options.params && !options.params instanceof Array){
        return callback(new ClientError(resultCode.C_CONTRACT_PARAMS));
    }
    if(typeof options.foo !== 'string'){
        return callback(new ClientError(resultCode.C_FOO_TYPE));
    }
    if (options.sequence && !/^\+?[1-9][0-9]*$/.test(options.sequence)) {//正整数
        return callback(new ClientError(resultCode.C_SEQUENCE));
    }

    var tx = remote.callContractTx(options);
    tx.setSecret(options.secret);
    if(options.sequence)
        tx.setSequence(options.sequence);
    tx.submit(function (err, result) {
        if(err) {
            var error = {};
            if(err.msg) error = err;
            else error.msg = err;
            logger.error('fail to call contract: ' + err);
            respond.transactionError(res, error);
        }else{
            if(result.ContractState !== 'fail'){
                result.ContractState = typeof result.ContractState === 'string' ? result.ContractState : JSON.parse(result.ContractState);
            }
            respond.success(res, result);
        }
    });
}

module.exports={
    deployContract: deployContract,
    callContract: callContract
};