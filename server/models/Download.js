const mongoose = require('mongoose');

var downloadSchema = new mongoose.Schema({
	fileName: String,
	type: String,
	showName: String
});

var Download = mongoose.model('Download', downloadSchema);

module.exports = {
	Download
};