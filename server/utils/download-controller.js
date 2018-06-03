var {Episode} = require('./../models/Episode');
var {Download} = require('./../models/Download');
var TransmissionWrapper = require('./../utils/transmission-wrapper');

module.exports.AddEpisodeDownload = async function (id, magnetLink) {
	return new Promise(async (resolve, reject) => {
		var reachable = await TransmissionWrapper.Ping();
		if (reachable)
		{
			var episode = await Episode.findById(id);
			var showName = episode.show.name;
			var arg = await TransmissionWrapper.AddUrl(magnetLink);
			var newDownload = new Download({
				type: 'tvshow',
				season: episode.season,
				episode: episode.number,
				episode_mongo_id: episode._id,
				showName: showName,
				fileName: 'a tvshow',
				hash_string: arg.hashString
			});

			await episode.update({
				downloaded: true
			});

			newDownload.save();
			resolve();
		}
		else
		{
			reject("Unable to reach download server at this time. Try again later.");
		}
	});
}

module.exports.AddMovieDownload = async function (magnetLink) {
	return new Promise(async (resolve, reject) => {
		var reachable = await TransmissionWrapper.Ping();
		if (reachable) {
			var arg = await TransmissionWrapper.AddUrl(magnetLink);
			var newDownload = new Download({
				type: 'movie',
				fileName: 'a movie',
				hash_string: arg.hashString
			});
			newDownload.save();
			resolve();
		} else {
			reject("Unable to reach download server at this time. Try again later.");
		}
	});
}