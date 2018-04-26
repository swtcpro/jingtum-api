var remote = require('../lib/remote');
const respond = require('../lib/respond');
var logger  = require('../lib/logger');
const resultCode = require('../lib/resultCode');
const ClientError  = require('../lib/errors').ClientError;
const NetworkError = require('../lib/errors').NetworkError;

function submitSign(req, res, callback) {
    if (!remote || !remote.isConnected()) {
        logger.error(resultCode.N_REMOTE.msg);
        return callback(new NetworkError(resultCode.N_REMOTE));
    }

    var options = {};
    options.blob = req.body.blob;
    if(typeof options.blob !== 'string'){
        return callback(new ClientError(resultCode.C_BLOB));
    }

    var tx = remote.buildSignTx(options);
    tx.submit(function (err, result) {
        if(err) {
            var error = {};
            if(err.msg) error = err;
            else error.msg = err;
            logger.error('fail to submit sign: ' + err);
            respond.transactionError(res, error);
        }else{
            respond.success(res, result);
        }
    });
}


module.exports={
    submitSign: submitSign
};