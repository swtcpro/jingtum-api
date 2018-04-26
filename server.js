var app     = require('./lib/app');
var config  = require('./lib/config');
var logger  = require('./lib/logger');
var WsServer= require('./lib/wsServer').WsServer;
var https   = require('https');
var fs      = require('fs');
var constants = require('constants');


var port = config.get('port') || 3000;
var host = config.get('host') || '127.0.0.1';
var wsPort = config.get('ws_port') || 5020;

function loadSSLConfig() {
    var keyPath  = config.get('ssl').key_path || './certs/server.key';
    var certPath = config.get('ssl').cert_path || './certs/server.crt';
    logger.info('SSL paths:', config.get('ssl').cert_path, config.get('ssl').key_path);

    if (!fs.existsSync(keyPath)) {
        logger.error('Must specify key_path in order to use SSL');
        logger.error('Cannot find key_path at:', keyPath);
        process.exit(1);
    }

    if (!fs.existsSync(certPath)) {
        logger.error('Must specify cert_path in order to use SSL');
        logger.error('Cannot find cert_path at:', certPath);
        process.exit(1);
    }

    return {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
        secureProtocol: 'SSLv23_method',
        secureOptions: constants.SSL_OP_NO_SSLv3
    };
}


if (config.get('ssl_enabled')) {
    https.createServer(loadSSLConfig(), app).listen(port, host, function() {
        logger.info('server listening over HTTPS at port ' + port);
    });
} else {
    app.listen(port, host, function() {
        logger.warn('server listening over HTTP at port ' + port + '\n');
    });
}



var wsServer = new WsServer(wsPort, host, function() {
	logger.info('ws server listening over UNSECURED WS at port ' + wsPort);
});

