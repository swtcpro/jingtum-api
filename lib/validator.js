var fs        = require('fs');
var path      = require('path');
var jayschema = require('jayschema');

var base_dir = path.join(__dirname, '/../schemas');

var validator = new jayschema();
var validate = validator.validate;

validator.validate = function() {
	var result = { err: validate.apply(validator, arguments) };
	result.isValid = !Boolean(result.err.length);
	return result;
};

validator.isValid = function() {
	return validator.validate.apply(validator, arguments).isValid;
};

// Load Schemas
fs.readdirSync(base_dir)
	.filter(function(filename) {
		return /^[\w\s]+\.json$/.test(filename);
	})
	.map(function(filename) {
		try {
      		return JSON.parse(fs.readFileSync(path.join(base_dir, filename), 'utf8'));
    	} catch (e) {
      		throw new Error('Failed to parse schema: ' + filename);
    	}
  	})
  	.forEach(function(schema) {
    	schema.id = schema.title;
    	validator.register(schema);
  	});

module.exports = validator;

