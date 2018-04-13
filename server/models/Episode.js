var mongoose = require('mongoose');

var Episode = mongoose.model('Episode', {
	name: String,
	image_url: String,
	season: Number,
	number: Number,
	date: Number,
	summary: String,
	api_id: Number,
	show: {
		name: String,
		mongo_id: String,
		api_id: Number
	}
});

module.exports = {
	Episode
};