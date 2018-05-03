const request = require('request-promise-native'),
	moment = require('moment'),
	_ = require('lodash'),
	mongoose = require('mongoose');

var { Show } = require('./../models/Show');

var episodeSchema = new mongoose.Schema({
	name: String,
	image_url: String,
	season: Number,
	number: Number,
	date: Number,
	date_formatted: String,
	premiered: Boolean,
	summary: String,
	api_id: Number,
	removed: Boolean,
	show: {
		name: String,
		mongo_id: String,
		api_id: Number
	},
	update_needed: Boolean
});

episodeSchema.statics.GetSortedEpisodes = async function (query, includeRemoved = false) {
	var episodes = await Episode.find(query);
	episodes = includeRemoved ? episodes : episodes.filter(episode => !episode.removed);
	episodes.sort(episodeSorter);
	return episodes;
}

function episodeSorter(a, b) {
	if (a.date == b.date) {
		if (a.season == b.season) {
			return a.number - b.number;
		}
		return a.season - b.season;
	}
	return a.date - b.date;
}

episodeSchema.statics.AddAllEpisodes = async function (show_doc, season) {
	var episodes_res = await request.get('http://api.tvmaze.com/shows/' + show_doc.api_id.toString() + '/episodes');
	var episodes_json = JSON.parse(episodes_res);
	// Loop through each episode and store it
	for (var i = 0; i < episodes_json.length; i++) {
		var removed = (season != 0 && episodes_json[i].season < season);
		await this.AddEpisode(episodes_json[i], show_doc, removed);
	}
}

episodeSchema.statics.AddEpisode = async function (episodeData, show_doc, removed) {
	var newEpisodeInfo = createEpisodeObject(episodeData, show_doc, removed);
	var episode = await Episode.find({api_id: episodeData.id})
	if (_.isEmpty(episode)) {
		var newEpisode = new Episode(newEpisodeInfo);
		await newEpisode.save();
	}
}

episodeSchema.statics.UpdateEpisodes = async function () {
	var episodes = await Episode.find({update_needed: true});
	// Loop through each episode
	await Promise.all(episodes.map(async (episode) => {
		var episodes_res = await getEpisodeData(episode.api_id, 1);
		if (episodes_res != undefined) {
			var episodes_json = JSON.parse(episodes_res);
			var newEpisodeInfo = createEpisodeObject(episodes_json, null, episode.removed);
			newEpisodeInfo.update_needed = false;
			await episode.update(newEpisodeInfo);
		}
		else {
			// Do something more here
			console.log(`Failed to update data for ${episode.name} of show ${episode.show.name}`);
		}
	}));
}

async function getEpisodeData(api_id, requestAttempt) {
	try {
		return await request.get('http://api.tvmaze.com/episodes/' + api_id);
	} catch (err) {
		if (err.statusCode == 429 && requestAttempt <= process.env.MAX_REPEATED_REQUEST_ATTEMPTS) {
			return new Promise((resolve, reject) => { 
					setTimeout(async () => { 
					resolve(await getEpisodeData(api_id, requestAttempt + 1));
				}, Math.floor((Math.random() * 1000) + 400));
			});
		} else {
			return null;
		}
	}
}

function createEpisodeObject(episodeData, show_doc, removed) {
	var airtimeInMillis = moment(episodeData.airdate + ' ' + episodeData.airtime, "YYYY-MM-DD HH:mm").valueOf();
	var runtimeInMillis = (episodeData.runtime * 60000);

	var date_formatted = '<p>' +
		moment(episodeData.airtime, "HH:mm").format("h:mm A") + '</p><p>' +
		moment(episodeData.airdate, "YYYY-MM-DD").format("dddd, MMMM Do YYYY") + '</p>';

	var episodeObject = {
		name: episodeData.name,
		image_url: episodeData.image != null ? episodeData.image.original : null,
		season: episodeData.season,
		number: episodeData.number,
		removed: removed,
		date: airtimeInMillis,
		date_formatted: date_formatted,
		premiered: (airtimeInMillis + runtimeInMillis < moment().valueOf()),
		summary: episodeData.summary,
		api_id: episodeData.id
	};
	if (show_doc != null) {
		episodeObject['show'] = {
			name: show_doc.name,
			mongo_id: show_doc._id,
			api_id: show_doc.api_id
		}
	}
	return episodeObject;
}

episodeSchema.statics.RemoveEpisode = async function(mongo_id) {
	await Episode.findByIdAndUpdate(mongo_id, {
		removed: true
	});
}

episodeSchema.statics.PermanentlyRemoveEpisodes = async function(query) {
	var episodes = await Episode.find(query);
	episodes.forEach(async episode => {
		await episode.remove();
	});
	return true;
}

var Episode = mongoose.model('Episode', episodeSchema);

module.exports = {
	Episode
};