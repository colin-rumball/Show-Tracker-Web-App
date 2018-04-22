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
	transmission = require('transmission'),
	favicon = require('serve-favicon');

var {mongoose} = require('./db/mongoose');
var {Episode} = require('./models/Episode');
var {Show} = require('./models/Show');
var {Download} = require('./models/Download');

var transmissionClient = new transmission({
	host: process.env.BITTORRENT_IP,
	port: process.env.BITTORRENT_PORT,
	username: process.env.BITTORRENT_USER,
	password: process.env.BITTORRENT_PASS
});

const SERVER_PORT = process.env.PORT;

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

// ROUTE | GET

app.get('/', async (req, res) => {
	TryUpdateAllInfo();
	var shows = await Show.find({});
	var episodes = await Episode.GetSortedEpisodes({});
	res.render('pages/home', {
		episodes,
		shows
	});
});

async function TryUpdateAllInfo() {
	var lastUpdate = mongoose.get('last-update');
	// If it's been at least 24 hours since the last update
	if (lastUpdate + process.env.UPDATE_FREQUENCY < moment().valueOf()) {
		mongoose.set('last-update', moment().valueOf());
		await Show.UpdateAllShows();
		await Episode.UpdateAllEpisodes();
	}
}

app.get('/show/:showName', async (req, res) => {
	var showName = req.params.showName;
	var show = await Show.findOne({name: showName});
	if (show != null) {
		var episodes = await Episode.GetSortedEpisodes({'show.api_id': show.api_id}, true);
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

app.get('/show/:id/episodes.json', async (req, res) => {
	var id = req.params.id;
	var query = id == 0 ? {} : { "show.mongo_id": id };
	var episodes = await Episode.GetSortedEpisodes(query);
	res.send(episodes);
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

app.post('/update', async (req, res) => {
	await Show.UpdateAllShows();
	await Episode.UpdateAllEpisodes();
	res.sendStatus(200);
});

app.post('/post-processing', async (req, res) => {
	var downloads = await Download.find({});
	downloads.forEach(async download => {
		try {
			var response = await request.post('http://192.168.1.2:2987/move-file', { 
				json: { 
					fileName: download.fileName, 
					type: download.type,
					showName: download.showName
				}
			});
			if (response != null) {
				download.remove();
			}
		} catch(err) {

		}
		
	});
	res.sendStatus(200);
});

app.post('/torrents', async (req, res) => {
	var magnetLink = req.body.link;
	var id = req.body.episode_id;
	var showName = (await Episode.findById(id)).show.name;
	transmissionClient.addUrl(magnetLink, function(err, arg) {
		if (err) {
			console.log(err, arg);
			return res.sendStatus(500);
		}

		var newDownload = new Download({
			fileName: arg.name,
			type: 'tvshow',
			showName: showName
		});
		newDownload.save();
		res.sendStatus(200);
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
			}
			console.log(err);
		}
	}
	return torrents;
}