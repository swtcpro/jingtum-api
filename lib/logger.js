var winston    = require('winston');
require('winston-daily-rotate-file');

var dateformat = require('dateformat');
var config     = require('./config');

// silly, debug, verbose, info, warn, error
var level     = config.get('log_options').level;
var filename  = config.get('log_options').filename;
var filesize  = config.get('log_options').filesize;
var filecount = config.get('log_options').filecount;

var timestampFn = function() {
	var now = new Date();
	return dateformat(now, "yyyy-mm-dd HH:MM:ss");
};

var logger = new winston.Logger({
	level: level,
	transports: [
		new winston.transports.Console({
			prettyPrint: true,
      		colorize: true,
      		timestamp: timestampFn,
      		handleExceptions: true
		}),
		new winston.transports.DailyRotateFile({
      		filename: filename,
      		datePattern: '.yyyy-MM-dd.log',
      		timestamp: timestampFn,
      		maxsize: filesize,
     		maxFiles: filecount,
      		json: false
		})
	]
});

module.exports = logger;

