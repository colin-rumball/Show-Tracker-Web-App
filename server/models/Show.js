var mongoose = require('mongoose');

var Show = mongoose.model('Show', {
	name: String,
	image_url: String,
	api_id: Number
});

module.exports = {
	Show
};