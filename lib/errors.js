const resultCode = require('./resultCode');
/**
 * client Error
 * Missing parameters or invalid parameters
 */
function ClientError(err) {
    this.msg = err.msg || err;
    this.code = err.code || resultCode.CLIENT_ERROR.code;
}
ClientError.prototype = new Error;
ClientError.prototype.name = 'ClientError';
ClientError.prototype.error = 'restINVALID_PARAMETER';

/**
 * Transaction Error
 * Failed transactions, no paths found, not enough balance, etc.
 */
function TransactionError(err) {
    this.msg = err.msg || err;
    this.code = err.code || resultCode.TRANSACTION_ERROR.code;
}
TransactionError.prototype = new Error;
TransactionError.prototype.name = 'TransactionError';

/**
 * Network Error
 * Request timed out，can not connect...
 */
function NetworkError(err) {
    this.msg = err.msg || err;
    this.code = err.code || resultCode.NETWORK_ERROR.code;
}
NetworkError.prototype = new Error;
NetworkError.prototype.name = 'NetworkError';

/**
 * API Error
 * API logic failed to do what it intended
 */
function ServerError(err) {
    this.msg = err.msg || err;
    this.code = err.code || resultCode.SERVER_ERROR.code;
}
ServerError.prototype = new Error;
ServerError.prototype.name = 'ServerError';

module.exports = {
    ClientError: ClientError,
    ServerError: ServerError,
    TransactionError: TransactionError,
    NetworkError: NetworkError
};
