const mongoose = require('mongoose');

var downloadSchema = new mongoose.Schema({
	type: String,
	season: Number,
	episode: Number,
	showName: String,
	fileName: String,
	hash_string: String,
	episode_mongo_id: String
});

var Download = mongoose.model('Download', downloadSchema);

module.exports = {
	Download
};