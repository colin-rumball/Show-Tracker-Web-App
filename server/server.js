require('./config/config');

const express = require('express'),
	request = require('request-promise-native'),
	bodyParser = require('body-parser'),
	fs = require('fs-extra'),
	_ = require('lodash'),
	path = require('path'),
	moment = require('moment'),
	hbs = require('hbs'),
	prettyBytes = require('pretty-bytes'),
	rarbgApi = require('rarbg-api'),
	utorrent = require('utorrent-api'),
	favicon = require('serve-favicon');

var {ObjectID} = require('mongodb');
var {mongoose} = require('./db/mongoose');
var {Show} = require('./models/Show');
var {Episode} = require('./models/Episode');

var utorrentClient = new utorrent(process.env.BITTORRENT_USER, process.env.BITTORRENT_USER);
utorrentClient.setCredentials(process.env.BITTORRENT_USER, process.env.BITTORRENT_PASS);

const SERVER_PORT = process.env.PORT;
const UPDATE_FREQUENCY = process.env.UPDATE_FREQUENCY;

var app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(favicon(path.join(__dirname, 'favicon', 'favicon.ico')));
app.set('views', path.join(__dirname, '..', 'views'));
app.set('view engine', 'hbs');

hbs.registerPartials(__dirname + '/../views/partials', () => {
	console.log('Partials registered!');
	app.listen(SERVER_PORT, () => {
		console.log(`Started server on port: ${SERVER_PORT} with env: ${process.env.node_env}`);
	});
});

app.get('/', async (req, res) => {
	CheckAndUpdateAllShows();
	var shows = await Show.find({});
	var episodes = await getSortedEpisodes({});
	res.render('pages/home', {
		episodes,
		shows
	});
});

app.get('/show/:showName', async (req, res) => {
	var showName = req.params.showName;
	var show = await Show.findOne({name: showName});
	if (show != null) {
		var episodes = await getSortedEpisodes({'show.api_id': show.api_id});
		res.render('pages/show', {
			episodes,
			show
		});
	}
	else {
		res.sendStatus(404);
	}
});

app.get('/show/:id/episodes.json', async (req, res) => {
	var id = req.params.id;
	var query = id == 0 ? {} : { "show.mongo_id": id };
	var episodes = await getSortedEpisodes(query);
	res.send(episodes);
});

app.get('/torrents/:id', (req, res) => {
	var id = req.params.id;
	Episode.findById(id).then((episode) => {
		var season = `s${("0" + episode.season).slice(-2)}`;
		var number = `e${("0" + episode.number).slice(-2)}`;
		var q = `${episode.show.name} ${season}${number}`;
		getTorrents(q).then((torrents) => {
			torrents.forEach(torrent => {
				torrent.size = prettyBytes(torrent.size);
			});
			res.send(torrents);
		}).catch((e) => {
			res.send(null);
		});
	});
});

// Put this before registering the static public file so we can return templates from the views folder
app.get('/public/templates/:template', (req, res) => {
	var template = req.params.template;
	fs.readFile(path.join(__dirname, '..', 'views', 'partials', template))
	.then((file) => {
		res.send(file);
	}).catch((e) => {
		res.sendStatus(404);
	});
});
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

app.post('/show/:id', (req, res) => {
	var id = req.params.id;
	var fromBeginning = req.body.fromBeginning;
	AddOrRefreshShowEpisodeData(id, fromBeginning ? 1 : moment().valueOf());
	res.sendStatus(200);
});

app.post('/update', async (req, res) => {
	var updated = await CheckAndUpdateAllShows(true);
	res.sendStatus(updated ? 200 : 500);
});

app.post('/torrents', (req, res) => {
	var magnetLink = req.body.link;
	utorrentClient.call('add-url', {s: magnetLink}, (err) => {
		if (err) {
			return res.sendStatus(500);
		}
		res.sendStatus(200);
	});
});

app.delete('/show/:id', async (req, res) => {
	var id = req.params.id;
	var show = await Show.findByIdAndRemove(id);
	var episodes = await Episode.find({'show.api_id': show.api_id});
	episodes.forEach(episode => {
		episode.remove();
	});
	res.sendStatus(200);
});

app.delete('/episode/:id', (req, res) => {
	var id = req.params.id;
	Episode.findByIdAndRemove(id, (episode) => {
		res.sendStatus(200);
	});
});

function getSortedEpisodes(query) {
	return Episode.find(query).then((episodes) => {
		// Order episodes so that the ones that air soonest are first
		episodes.sort(episodeSorter);
		return episodes;
	});
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

async function getTorrents(query) {
	var requestsMade = 0;
	var torrents = null;
	while (requestsMade < 5 && torrents == null) {
		requestsMade++;
		torrents = await rarbgApi.search(query, {
			category: rarbgApi.CATEGORY.TV_HD_EPISODES,
			sort: 'seeders'
		});
	}
	return torrents;
}

async function CheckAndUpdateAllShows(forceUpdate = false) {
	var lastUpdate = mongoose.get('last-update') || (moment().valueOf() - UPDATE_FREQUENCY);
	// If it's been at least 24 hours since the last update
	if (forceUpdate || lastUpdate + UPDATE_FREQUENCY < moment().valueOf()) {
		mongoose.set('last-update', moment().valueOf());
		RefreshAllShowEpisodeData(lastUpdate);
	}
	return true;
}

function RefreshAllShowEpisodeData(lastUpdatedDate) {
	Show.find({}).then((shows) => {
		// Loop through each show
		shows.forEach(show => {
			AddOrRefreshShowEpisodeData(show.api_id, lastUpdatedDate);
		});
	});
}

function AddOrRefreshShowEpisodeData(showId, lastUpdatedDate) {
	// get api info
	request.get('http://api.tvmaze.com/shows/' + showId)
		.then((showResponseData) => {
			var showJsonData = JSON.parse(showResponseData);
			// Try to find the show in the DB
			Show.findOne({ api_id: showId })
				.then((showDatabaseData) => {
					if (showDatabaseData != null) {
						// The show was added previously so update it
						Show.findByIdAndUpdate(showDatabaseData.id, {
							name: showJsonData.name,
							image_url: showJsonData.image.original,
							api_id: showJsonData.id
						}).then((show_doc) => {
							RefreshAllEpisodesData(lastUpdatedDate, show_doc);
						});
					}
					else {
						// It's a new show so add it
						var newShow = new Show({
							name: showJsonData.name,
							image_url: showJsonData.image.original,
							api_id: showJsonData.id
						});

						newShow.save().then((show_doc) => {
							RefreshAllEpisodesData(lastUpdatedDate, show_doc);
						});
					}
				});
		});
}

function RefreshAllEpisodesData(lastUpdatedDate, show_doc) {
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
			date: episodeAirDate,
			date_formatted: moment(episodeData.airdate, "YYYY-MM-DD").format("dddd, MMMM Do YYYY"),
			premiered: (episodeAirDate < moment().valueOf()),
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