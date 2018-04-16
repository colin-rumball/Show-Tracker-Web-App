require('./config/config');

const express = require('express'),
	request = require('request-promise-native'),
	bodyParser = require('body-parser'),
	fs = require('fs-extra'),
	_ = require('lodash'),
	path = require('path'),
	moment = require('moment'),
	hbs = require('hbs'),
	favicon = require('serve-favicon');

var {ObjectID} = require('mongodb');
var {mongoose} = require('./db/mongoose');
var {Show} = require('./models/Show');
var {Episode} = require('./models/Episode');

const SERVER_PORT = process.env.PORT;
const PATH_TO_SHOWS_JSON = path.join(__dirname, 'shows', 'shows.json');
const UPDATE_FREQUENCY = 3600000 * 24; // 1 hour * 24

var app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use('/public', express.static(path.join(__dirname, '..', 'public')));
app.use(favicon(path.join(__dirname, 'favicon', 'favicon.ico')));
app.set('views', path.join(__dirname, '..', 'views'));
app.set('view engine', 'hbs');

hbs.registerPartials(__dirname + '/../views/partials', () => {
	console.log('Partials registered!');
	app.listen(SERVER_PORT, () => {
		console.log(`Started server on port: ${SERVER_PORT} with env: ${process.env.node_env}`);
	});
});

app.get('/', (req, res) => {
	fs.readJson(PATH_TO_SHOWS_JSON).then((showsJson) => {
		// If it's been at least 24 hours since the last update
		if (showsJson.last_updated + UPDATE_FREQUENCY < moment().valueOf()) {
			RefreshShowInfos(showsJson.last_updated);
			showsJson.last_updated = moment().valueOf();
			fs.writeJson(PATH_TO_SHOWS_JSON, showsJson);
		}
		Show.find({}).then((shows) => {
			Episode.find({}).then((episodes) => {
				// Order episodes so that the ones that air soonest are first
				episodes.sort(function (a, b) {
					return a.date - b.date;
				});
				res.render('pages/home', {
					episodes,
					shows
				});
			});
		});
	});
});

app.get('/show/:id', (req, res) => {
	var id = req.params.id;
	var query = id == 0 ? {} : { "show.mongo_id": id };
	Episode.find(query).then((episodes) => {
		// Order episodes so that the ones that air soonest are first
		episodes.sort(function (a, b) {
			return a.date - b.date;
		});
		res.send(episodes);
	});
})

app.post('/show/add/:id', (req, res) => {
	var id = req.params.id;
	fs.readJson(PATH_TO_SHOWS_JSON).then((showsJson) => {
		showsJson.show_ids.push(Number.parseInt(id));
		fs.writeJson(PATH_TO_SHOWS_JSON, showsJson).then((data) => {
			RefreshShowInfos(showsJson.last_updated);
		});
	});
});

app.delete('/episode/:id', (req, res) => {
	var id = req.params.id;
	Episode.findByIdAndRemove(id, (episode) => {
		res.sendStatus(200);
	});
});

function RefreshShowInfos(lastUpdatedDate) {
	fs.readJson(PATH_TO_SHOWS_JSON).then((showsJson) => {
		// Loop through each show
		for (var i = 0; i < showsJson.show_ids.length; i++) {
			// get api info
			request.get('http://api.tvmaze.com/shows/' + showsJson.show_ids[i])
			.then((showResponseData) => {
				var showJsonData = JSON.parse(showResponseData);
				// Try to find the show in the DB
				Show.findOne({api_id: showJsonData.id})
				.then((showDatabaseData) => {
					if (showDatabaseData != null) {
						// The show was added previously so update it
						Show.findByIdAndUpdate(showDatabaseData.id, {
							name: showJsonData.name,
							image_url: showJsonData.image.original,
							api_id: showJsonData.id
						}).then((show_doc) => {
							RefreshEpisodeInfos(lastUpdatedDate, show_doc);
						});
					}
					else
					{
						// It's a new show so add it
						var newShow = new Show({
							name: showJsonData.name,
							image_url: showJsonData.image.original,
							api_id: showJsonData.id
						});

						newShow.save().then((show_doc) => {
							RefreshEpisodeInfos(lastUpdatedDate, show_doc);
						});
					}
				});
			});
		}
	});
}

function RefreshEpisodeInfos(lastUpdatedDate, show_doc) {
	request.get('http://api.tvmaze.com/shows/' + show_doc.api_id.toString() + '/episodes').then((episode_res) => {
		var episode_json = JSON.parse(episode_res);
		// Loop through each episode and store it
		for (var j = 0; j < episode_json.length; j++) {
			storeEpisodeData(lastUpdatedDate, episode_json[j], show_doc);
		}
	});
}

function storeEpisodeData(lastUpdatedDate, episodeData, show_doc) {
	var episodeAirDate = moment(episodeData.airdate, "YYYY-MM-DD").valueOf();
	// Only update or add it if the airdate occurs after the last time we updated show infos
	if (episodeAirDate > lastUpdatedDate) {
		var newEpisodeInfo = {
			name: episodeData.name,
			image_url: episodeData.image != null ? episodeData.image.original : null,
			season: episodeData.season,
			number: episodeData.number,
			date: moment(episodeData.airdate, "YYYY-MM-DD").valueOf(),
			date_formatted: moment(episodeData.airdate, "YYYY-MM-DD").format("dddd, MMMM Do YYYY"),
			summary: episodeData.summary,
			api_id: episodeData.id,
			show: {
				name: show_doc.name,
				mongo_id: show_doc._id,
				api_id: show_doc.api_id,
				image_url: show_doc.image_url
			}
		};
		Episode.findOneAndUpdate({ api_id: episodeData.id }, newEpisodeInfo)
		.then((episode_doc) => {
			// If no episode was updated then create a new one
			if (episode_doc === null) {
				var newEpisode = new Episode(newEpisodeInfo);
				return newEpisode.save();
			}
		})
		.then((episode_doc) => {
			if (episode_doc !== null) {
				// A new doc was saved
			}
		})
		.catch((e) => {
			console.error(e);
		})
	}
}