const mongoose = require('mongoose');

var downloadSchema = new mongoose.Schema({
	type: String,
	season: Number,
	episode: Number,
	showName: String,
	hash_string: String
});

var Download = mongoose.model('Download', downloadSchema);

module.exports = {
	Download
};