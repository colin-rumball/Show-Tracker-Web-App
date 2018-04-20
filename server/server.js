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
	transmission = require('transmission'),
	favicon = require('serve-favicon');

var {ObjectID} = require('mongodb');
var {mongoose} = require('./db/mongoose');
var {Episode} = require('./models/Episode');
var {Show} = require('./models/Show');

var transmissionClient = new transmission();

var utorrentClient = new utorrent(process.env.BITTORRENT_IP, process.env.BITTORRENT_PORT);
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
	TryUpdateAllInfo();
	var shows = await Show.find({});
	var episodes = await Episode.GetSortedEpisodes({});
	res.render('pages/home', {
		episodes,
		shows
	});
});

async function TryUpdateAllInfo() {
	var lastUpdate = 1;//mongoose.get('last-update');
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

app.post('/show/:id', async (req, res) => {
	var api_id = req.params.id;
	var fromBeginning = req.body.fromBeginning;
	var newShow = await Show.AddShow(api_id, fromBeginning);
	await Episode.AddAllEpisodes(newShow);
	res.send({name: newShow.name});
});

app.post('/update', async (req, res) => {
	await Show.UpdateAllShows();
	await Episode.UpdateAllEpisodes();
	res.sendStatus(200);
});

app.post('/torrents', (req, res) => {
	var magnetLink = req.body.link;
	transmissionClient.addUrl(magnetLink, function(err, arg) {
		console.log(err, arg);
	});
	// utorrentClient.call('add-url', {s: magnetLink}, (err) => {
	// 	if (err) {
	// 		return res.sendStatus(500);
	// 	}
	// 	res.sendStatus(200);
	// });
});

app.delete('/show/:id', async (req, res) => {
	var mongo_id = req.params.id;
	var show = await Show.PermanentlyRemoveShow(mongo_id);
	await Episode.PermanentlyRemoveEpisodes({ 'show.api_id': show.api_id });
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
		torrents = await rarbgApi.search(query, {
			category: rarbgApi.CATEGORY.TV_HD_EPISODES,
			sort: 'seeders'
		});
	}
	return torrents;
}