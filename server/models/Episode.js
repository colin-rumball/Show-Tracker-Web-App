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
	removed: {
		type: Boolean,
		default: false
	},
	show: {
		name: String,
		mongo_id: String,
		api_id: Number,
		image_url: String
	}
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

episodeSchema.statics.AddAllEpisodes = async function (show_doc) {
	var episodes_res = await request.get('http://api.tvmaze.com/shows/' + show_doc.api_id.toString() + '/episodes');
	var episodes_json = JSON.parse(episodes_res);
	// Loop through each episode and store it
	for (var j = 0; j < episodes_json.length; j++) {
		await this.AddEpisode(episodes_json[j], show_doc);
	}
}

episodeSchema.statics.AddEpisode = async function (episodeData, show_doc) {
	var newEpisodeInfo = getEpisodeObject(episodeData, show_doc);
	var episode = await Episode.find({api_id: episodeData.id})
	if (_.isEmpty(episode)) {
		var newEpisode = new Episode(newEpisodeInfo);
		await newEpisode.save();
	}
}

episodeSchema.statics.UpdateAllEpisodes = async function() {
	var episodes = await Episode.find({});
	episodes.forEach(async episode => {
		var episodes_res = await request.get('http://api.tvmaze.com/episodes/' + episode.api_id.toString());
		var showResponseData = await request.get('http://api.tvmaze.com/shows/' + episode.show.api_id);
		var episodes_json = JSON.parse(episodes_res);
		var showJsonData = JSON.parse(showResponseData);
		var newEpisodeInfo = getEpisodeObject(episodes_json);
		newEpisodeInfo['show'] = {
			name: episode.show.name,
			mongo_id: episode.show.mongo_id,
			api_id: episode.show.api_id,
			image_url: showJsonData.image.original
		}
		await episode.update(newEpisodeInfo);
	});
}

function getEpisodeObject(episodeData, show_doc) {
	var episodeObject = {
		name: episodeData.name,
		image_url: episodeData.image != null ? episodeData.image.original : null,
		season: episodeData.season,
		number: episodeData.number,
		date: moment(episodeData.airdate, "YYYY-MM-DD").valueOf(),
		date_formatted: moment(episodeData.airdate, "YYYY-MM-DD").format("dddd, MMMM Do YYYY"),
		premiered: (moment(episodeData.airdate, "YYYY-MM-DD").valueOf() < moment().valueOf()),
		summary: episodeData.summary,
		api_id: episodeData.id
	};
	if (show_doc != null) {
		episodeObject['show'] = {
			name: show_doc.name,
			mongo_id: show_doc._id,
			api_id: show_doc.api_id,
			image_url: show_doc.image_url
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