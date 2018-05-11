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
	favicon = require('serve-favicon');

var {mongoose} = require('./db/mongoose');
var {Episode} = require('./models/Episode');
var {Show} = require('./models/Show');
var {Download} = require('./models/Download');
var TransmissionWrapper = require('./utils/transmission-wrapper');

const SERVER_PORT = process.env.PORT;

var app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(favicon(path.join(__dirname, 'favicon', 'favicon.ico')));
app.set('views', path.join(__dirname, '..', 'views'));
app.set('view engine', 'hbs');

mongoose.set('currently-updating', false);
mongoose.set('currently-post-processing', false);

hbs.registerPartials(__dirname + '/../views/partials', () => {
	console.log('Partials registered!');
	app.listen(SERVER_PORT, () => {
		console.log(`Started server on port: ${SERVER_PORT} with env: ${process.env.node_env}`);
	});
});

// ROUTE | GET

app.get('/', async (req, res) => {
	TryToUpdateAllInfo();
	var shows = await Show.find({});
	var episodes = await Episode.GetSortedEpisodes({});
	episodes.forEach((episode) => {
		episode.show['image_url'] = shows.find(show => show.api_id == episode.show.api_id).image_url;
	});
	res.render('pages/home', {
		episodes,
		shows
	});
});

async function TryToUpdateAllInfo(res = null) {
	var isUpdating = mongoose.get('currently-updating') || false;
	if (!isUpdating) {
		mongoose.set('currently-updating', true);
		try {
			// Shows update less often than episodes
			var lastShowUpdate = mongoose.get('last-show-update') || 1;
			var timeToUpdateShows = lastShowUpdate + Number.parseInt(process.env.SHOW_UPDATE_FREQUENCY);
			if (timeToUpdateShows < moment().valueOf()) {
				await Show.update({}, {update_needed: true}, {multi: true});
				mongoose.set('last-show-update', moment().valueOf());
			}

			var lastEpisodeUpdate = mongoose.get('last-episode-update') || 1;
			var timeToUpdateEpisodes = lastEpisodeUpdate + Number.parseInt(process.env.EPISODE_UPDATE_FREQUENCY);
			if (timeToUpdateEpisodes < moment().valueOf()) {
				await Episode.update({ removed: false }, { update_needed: true }, { multi: true });
				mongoose.set('last-episode-update', moment().valueOf());
			}
			await Episode.UpdateEpisodes();
			await Show.UpdateShows();

			if (res != null) {
				res.sendStatus(200);
			}
		} catch(err) {
			if (res != null) {
				res.status(500).send(err);
			}
		}
		mongoose.set('currently-updating', false);
	} else {
		if (res != null) {
			res.status(500).send('The database is currently in the middle of an update. Please try again later.');
		}
	}
}

app.get('/show/:showName', async (req, res) => {
	var showName = req.params.showName;
	var show = await Show.findOne({name: showName});
	if (show != null) {
		var episodes = await Episode.GetSortedEpisodes({ 'show.api_id': show.api_id }, true);
		episodes.forEach(episode => {
			episode.alternativeStyle = true;
		});
		res.render('pages/show', {
			episodes,
			show
		});
	}
	else {
		res.sendStatus(404);
	}
});

app.get('/torrents', async (req, res) => {
	TransmissionWrapper.GetTorrents().then((arg) => {
		arg.torrents.forEach(torrent => {
			torrent.downloadRate = Math.round(torrent.rateDownload / 1000) + ' kB/s';
			torrent.progress = torrent.percentDone * 100;
			torrent.eta = Math.round(torrent.eta / 60) + ' Minutes';
		});

		res.render('pages/torrents', {
			torrents: arg.torrents
		});
	}).catch((err) => {
		return res.status(500).send(err);
	});
});

app.get('/show/:id/episodes.json', async (req, res) => {
	var id = req.params.id;
	var query = id == 0 ? {} : { "show.mongo_id": id };
	var episodes = await Episode.GetSortedEpisodes(query);
	var shows = id == 0 ? await Show.find({}) : [await Show.findById(id)];
	res.send({episodes, shows});
});

app.get('/episode/torrents/:id', async (req, res) => {
	var mongo_id = req.params.id;
	var episode = await Episode.findById(mongo_id)
	if (episode != null) {
		var season = `s${("0" + episode.season).slice(-2)}`;
		var number = `e${("0" + episode.number).slice(-2)}`;
		var q = `${episode.show.name} ${season}${number}`;
		var torrents = await getTorrents(q)
		torrents.forEach(torrent => {
			torrent.size = prettyBytes(torrent.size);
		});
		res.send(torrents);
	}
	else {
		res.send(null);
	}
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

// ROUTE | POST

app.post('/show/:id', async (req, res) => {
	var api_id = req.params.id;
	var season = Number.parseInt(req.body.season);
	var newShow = await Show.AddShow(api_id);
	if (newShow != null) {
		await Episode.AddAllEpisodes(newShow, season);
	}
	res.send({name: newShow.name});
});

app.post('/update-all', async (req, res) => {
	var newValue = moment().valueOf() - (process.env.SHOW_UPDATE_FREQUENCY + 1000);
	mongoose.set('last-show-update', newValue);
	await TryToUpdateAllInfo(res);
});

app.post('/update-episodes', async (req, res) => {
	var newValue = moment().valueOf() - (process.env.EPISODE_UPDATE_FREQUENCY + 1000);
	mongoose.set('last-episode-update', newValue);
	await TryToUpdateAllInfo(res);
});

app.post('/post-processing', async (req, res) => {
	var isPostProcessing = mongoose.get('currently-post-processing');
	if (!isPostProcessing)
	{
		mongoose.set('currently-post-processing', true);
		// Get all the active torrents
		TransmissionWrapper.GetTorrents().then(async (arg) => {
			// Process each torrent
			await Promise.all(arg.torrents.map(async (torrent) => {
				// Only proceed if the torrent is done downloading
				if (torrent.status != TransmissionWrapper.status.SEED &&
					torrent.status != TransmissionWrapper.status.SEED_WAIT)
				{
					return null;
				}

				// Find video file of episode
				var largestFile = { length: 1 };
				torrent.files.forEach(file => {
					largestFile = file.length > largestFile.length ? file : largestFile;
				});

				// Get download object model
				var download = await Download.findOne({ hash_string: torrent.hashString });
				if (download == null) {
					throw new Error(`Download for ${torrent.name} not found. Attempt manual post processing and torrent removal.`);
				}

				// Update download with the file name in case the move fails
				await download.update({ fileName: largestFile.name});

				// Remove torrent from bittorrent
				await TransmissionWrapper.RemoveTorrent(torrent.id);
				
				// Tell post processor to move the file to Plex
				var destination = path.join(download.showName, `Season ${download.season}`, largestFile.name);
				await request.post(process.env.POST_PROCESSING_URL, {
					json: {
						file: largestFile.name,
						destination: destination,
						type: download.type
					}
				});

				// Mark the episode as removed
				await Episode.RemoveEpisode(download.episode_mongo_id);

				// Return the download of the episode processed and delete the download object off of the DB
				download.remove();
				return download; 
			})).then((downloadsMoved) => {
				downloadsMoved = downloadsMoved.filter(d => d != null)
				var filesMoved = [];
				downloadsMoved.forEach(download => {
					var season = `s${("0" + download.season).slice(-2)}`;
					var episode = `e${("0" + download.episode).slice(-2)}`;
					filesMoved.push({
						message: `${download.showName} ${season}${episode}`,
						id: download.episode_mongo_id
					});
				});
				
				// Only on success
				res.setHeader('Content-Type', 'application/json');
				var responseMessage = JSON.stringify(filesMoved);
				res.send(responseMessage);
			}).catch((err) => {
				res.status(500).send(err);
			});
			mongoose.set('currently-post-processing', false);
		}).catch((err) => {
			mongoose.set('currently-post-processing', false);
			return res.status(500).send(err);
		});
	} else {
		if (res != null) {
			res.status(500).send('The database is currently in the middle of processing. Please try again later.');
		}
	}
});

app.post('/torrents', async (req, res) => {
	var magnetLink = req.body.link;
	var id = req.body.episode_id;
	var episode = await Episode.findById(id);
	await episode.update({ downloaded: true});
	var showName = episode.show.name;
	TransmissionWrapper.AddUrl(magnetLink).then((arg) => {
		var newDownload = new Download({
			type: 'tvshow',
			season: episode.season,
			episode: episode.number,
			episode_mongo_id: episode._id,
			showName: showName,
			hash_string: arg.hashString
		});
		newDownload.save();
		res.sendStatus(200);
	}).catch((err) => {
		res.status(500).send(err)
	});
});

// ROUTE | DELETE

app.delete('/show/:id', async (req, res) => {
	var mongo_id = req.params.id;
	var show = await Show.PermanentlyRemoveShow(mongo_id);
	if (show != null) {
		await Episode.PermanentlyRemoveEpisodes({ 'show.api_id': show.api_id });
	}
	res.sendStatus(200);
});

app.delete('/episode/:id', async (req, res) => {
	var mongo_id = req.params.id;
	Episode.RemoveEpisode(mongo_id);
	res.sendStatus(200);
});

async function getTorrents(query) {
	var requestsMade = 0;
	var torrents = null;
	while (requestsMade < 5 && torrents == null) {
		requestsMade++;
		try {
			torrents = await rarbgApi.search(query, {
				/*category: rarbgApi.CATEGORY.TV_HD_EPISODES,*/
				sort: 'seeders'
			});
		} catch(err) {
			if (err.error_code == 20) {
				// No results found
				return [];
			} else
			{
				console.log(err);
			}
		}
	}
	return torrents;
}