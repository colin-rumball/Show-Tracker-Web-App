const request = require('request-promise-native'),
	moment = require('moment'),
	_ = require('lodash'),
	mongoose = require('mongoose');

var { Episode } = require('./../models/Episode');

var showSchema = new mongoose.Schema({
	name: String,
	image_url: String,
	api_id: Number
});

showSchema.statics.AddShow = async function (api_id) {
	var show = await Show.find({api_id: api_id});
	if (_.isEmpty(show)) {
		var showResponseData = await request.get('http://api.tvmaze.com/shows/' + api_id);
		var apiJsonData = JSON.parse(showResponseData);
		var newShow = new Show({
			name: apiJsonData.name,
			image_url: apiJsonData.image.original,
			api_id: apiJsonData.id
		});
		return await newShow.save();
	}
	return show;
}

showSchema.statics.PermanentlyRemoveShow = async function (mongo_id) {
	var show = await Show.findByIdAndRemove(mongo_id);
	return show;
}

showSchema.statics.UpdateAllShows = async function () {
	var shows = await Show.find({});
	// Loop through each show
	shows.forEach(async show => {
		// get api info
		var showResponseData = await request.get('http://api.tvmaze.com/shows/' + show.api_id);
		var showJsonData = JSON.parse(showResponseData);
		await show.update({
			name: showJsonData.name,
			image_url: showJsonData.image.original,
			api_id: showJsonData.id
		});
	});
}

var Show = mongoose.model('Show', showSchema);

module.exports = {
	Show
};