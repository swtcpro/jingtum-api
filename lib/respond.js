const _      = require('lodash');
const logger = require('./logger');
const resultCode = require('./resultCode');
const ErrorType = {
	network: 'networkError',
	transaction: 'transactionError',
	server: 'serverError',
	client: 'clientError'
};
const StatusCode = { //http code
	ok: 200
};

/**
 * Send a JSON response
 *
 * @param res - response object
 * @param body
 * @param code
 */
function send(res, body, code) {
	if (!res._headerSent) {
		res.status(code).json(body);
	}
}

/**
 * Send a success response
 *
 * @param response - response object
 * @param body - (optional) body to the response, in addition to the success property
 */
function success(response, body) {
	var content = {
		success: true,
		status_code: resultCode.SUCCESS.code
	};

	if (body !== void(0)) {
		content = _.extend(content, body);
	}

	// logger.info('[res], success', JSON.stringify(content), resultCode.SUCCESS.code);

	send(response, content, StatusCode.ok);
}

/**
 * Send an transaction error response
 *
 * @param response  - response object
 * @param error   - (optional) message to accompany and describe the invalid response
 */
function transactionError(response, error) {
	var content = {
		success: false,
		status_code: error.code || '3000',
		error_type: ErrorType.transaction
	};

	if (error.msg) {
		content.message = error.msg;
	}
	//if (body !== void(0)) {
	//	content = _.extend(content, body);
	//}
	logger.error('[res], tx', JSON.stringify(content), error.code);

	send(response, content, StatusCode.ok);
}

/**
 * Send an server error response
 *
 * @param response  - response object
 * @param error   - (optional) message to accompany and describe the invalid response
 */
function serverError(response, error) {
	var content = {
		success: false,
		status_code: error.code || '2000',
		error_type: ErrorType.server
	};

	if (error.msg || error.error_message) {
		content.message = error.msg || error.error_message;
	}

	logger.error('[res], server error', JSON.stringify(content), error.code);

	send(response, content, StatusCode.ok);
}

/**
 * Send an client error response
 *
 * @param response  - response object
 * @param error     - error to send back to the client
 */
function clientError(response, error) {
	var content = {
		success: false,
		status_code: error.code || '1000',
		error_type: ErrorType.client,
		error: error.error
	};

	if (error.msg) {
		content.message = error.msg;
	}

	logger.error('[res], client error', JSON.stringify(content), error.code);

	send(response, content, StatusCode.ok);
}

/**
 * Send a network error response
 *
 * @param response  - response object
 * @param error   - (optional) additional error message
 */
function networkError(response, error) {
	var content = {
		success: false,
		status_code: error.code || '4000',
		error_type: ErrorType.network
	};

	if (error.msg) {
		content.message = error.msg;
	}

	logger.error('[res], network error', JSON.stringify(content), error.code);

	send(response, content, StatusCode.ok);
}

module.exports = {
	success: success,
	clientError: clientError,
	serverError: serverError,
	networkError: networkError,
	transactionError: transactionError
};

