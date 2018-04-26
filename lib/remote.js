/**
 * Created by wudan on 2017/7/25.
 */
var config  = require('./config');
var logger  = require('./logger');
var utils   = require('./utils');
var Remote  = require('jingtum-lib').Remote;
var remote = new Remote(config.get('skywelld_servers'));


remote.connect(function (err, data) {
    if (err) {
        logger.error('fail connect jingtum' + err);
    } else {
        logger.info('connect to jingtum');

        remote.on('disconnect', function () {
            logger.error('disconnect to jingtum');
        });

        remote.on('reconnect', function () {
            logger.error('reconnect to jingtum');
        });

        remote.on('transactions', function (tx) {
            //logger.info('remote get transactions:',tx);
        });
    }
});


module.exports = remote;

