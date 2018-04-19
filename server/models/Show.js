var mongoose = require('mongoose');
var { Episode } = require('./../models/Episode');

var showSchema = new mongoose.Schema({
	name: String,
	image_url: String,
	api_id: Number
});

var Show = mongoose.model('Show', showSchema);

module.exports = {
	Show
};