var path   = require('path');
var nconf  = require('nconf');

// set up nconf to use:
// 1. Command-line arguments
// 2. Environment variables
// 3. A file localted at ../config.json

nconf.argv()
	.env();

var config_file = path.join(__dirname, '../config.json');

// load config.json
try {
	nconf.file(config_file);
} catch (e) {
	console.error(e);
	process.exit(1);
}

module.exports = nconf;
