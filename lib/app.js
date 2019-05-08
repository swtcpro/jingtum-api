const express     = require('express');
const bodyParser  = require('body-parser');
const compression = require('compression');
const router      = require('./router');
const errorHandler = require('./error-handler');
const validator   = require('./validator');
const ClientError = require('./errors').ClientError;

var app = express();

app.set('json spaces', 2);
app.disable('x-powered-by');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.set('view engine', 'ejs');
app.use(compression());

app.use(function(req, res, next) {
	if (req.url === '/favicon.ico')
		return;
	res.header('Access-Control-Allow-Origin', '*');
  	res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  	res.header('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
  	next();
});

// middleware
// get api version before they transfered to the mounted router
function handleVersion(req, res, next) {
	var version = req.params.version;
	if (validator.isValid(version, 'ApiVersion')) {
		req.api_version = version;
		next();
	} else {
		var error = {};
		error.msg = "Bad ApiVersion: " + req.originalUrl;
		next(new ClientError(error));
	}
}

app.use('/:version', handleVersion, router);
app.use('/', (new express.Router()).get('/', router.IndexPage));
app.use(errorHandler);
app.use(function(req, res, next){
    res.status(404).send('404 NOT FOUND');
    next();
});
app.use(function (err, req, res, next) {
    console.log("Error happens", err.stack);
    res.status(500).send('500 SOMETHING BROKE');
});

module.exports = app;

