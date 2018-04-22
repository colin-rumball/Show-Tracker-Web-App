const mongoose = require('mongoose');

var downloadSchema = new mongoose.Schema({
	fileName: String,
	type: String,
	showName: String,
	torrent_id: Number
});

var Download = mongoose.model('Download', downloadSchema);

module.exports = {
	Download
};