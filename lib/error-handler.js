const errors = require('./errors');
const logger = require('./logger');
const respond = require('./respond');
const ClientError           = errors.ClientError;
const ServerError           = errors.ServerError;
const TransactionError      = errors.TransactionError;
const NetworkError          = errors.NetworkError;

function handleError(error, req, res, next) {
	logger.error('handleError', error);

	switch(error.name){
		case ClientError.name:
			respond.clientError(res, error);
			break;
		case ServerError.name:
			respond.serverError(res, error);
			break;
		case TransactionError.name:
			respond.transactionError(res, error);
			break;
		case NetworkError.name:
			respond.networkError(res, error);
			break;
	}
	next(error);
}

module.exports = handleError;

