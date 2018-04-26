const Wallet     = require('jingtum-lib').Wallet;
const respond    = require('../lib/respond');
const errors     = require('../lib/errors');
const resultCode = require('../lib/resultCode');

function generate(req, res, next) {
	var wallet = Wallet.generate();

	if (wallet) {
		respond.success(res, {wallet: wallet});
	} else {
		next(new errors.TransactionError(resultCode.T_WALLET));
	}
}

module.exports = {
	generate: generate
};