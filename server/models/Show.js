const request = require('request-promise-native'),
	moment = require('moment'),
	_ = require('lodash'),
	mongoose = require('mongoose');

var { Episode } = require('./Episode');

var showSchema = new mongoose.Schema({
	name: String,
	image_url: String,
	api_id: Number,
	update_needed: Boolean
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

showSchema.statics.UpdateShows = async function () {
	var shows = await Show.find({update_needed: true});
	// Loop through each show
	if (shows.length > 0) {
		await Promise.all(shows.map(async (show) => {
			// get api info
			var showResponseData = await getShowData(show.api_id, 1);
			if (showResponseData != undefined) {
				var showJsonData = JSON.parse(showResponseData);
				await show.update({
					name: showJsonData.name,
					image_url: showJsonData.image.original,
					api_id: showJsonData.id,
					update_needed: false
				});

				await addMissingEpisodes(show);
			}
			else {
				return show;
			}
		})).then((failedShows) => {
			// Filter out the null shows
			failedShows = failedShows.filter(s => s != null);
			if (failedShows.length > 0) {
				failedMessage = "These shows failed to update: <ul>";
				failedShows.forEach(show => {
					failedMessage += `<li>${show.name}</li>`
				});
				failedMessage = "</ul>";
				throw new Error(failedMessage);
			}
		}).catch((err) => {
			throw new Error(err);
		});
	}
}

async function addMissingEpisodes(show_doc) {
	var episodesFromAPI = await getEpisodesData(show_doc.api_id, 1);
	if (episodesFromAPI != undefined) {
		var episodeJsonData = JSON.parse(episodesFromAPI);
		episodeJsonData.forEach(episode => {
			Episode.AddEpisode(episode, show_doc, false);
		});
	}
}

async function getEpisodesData(api_id, requestAttempt) {
	try {
		return await request.get('http://api.tvmaze.com/shows/' + api_id + '/episodes');
	} catch (err) {
		if (err.statusCode == 429 && requestAttempt <= process.env.MAX_REPEATED_REQUEST_ATTEMPTS) {
			return new Promise((resolve, reject) => {
				setTimeout(async () => {
					resolve(await getEpisodesData(api_id, requestAttempt + 1));
				}, 500);
			});
		} else {
			return null;
		}
	}
}

async function getShowData(api_id, requestAttempt) {
	try {
		return await request.get('http://api.tvmaze.com/shows/' + api_id);
	} catch(err) {
		if (err.statusCode == 429 && requestAttempt <= process.env.MAX_REPEATED_REQUEST_ATTEMPTS) {
			return new Promise((resolve, reject) => {
				setTimeout(async () => {
					resolve(await getShowData(api_id, requestAttempt + 1));
				}, 500);
			});
		} else {
			return null;
		}
	}
}

var Show = mongoose.model('Show', showSchema);

module.exports = {
	Show
};