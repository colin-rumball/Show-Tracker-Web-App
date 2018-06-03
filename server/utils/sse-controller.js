var TransmissionWrapper = require('./transmission-wrapper');
const _ = require('lodash');

var currentTorrentConnections = [];
var torrentStreamRunning = false;
var intervalID;

module.exports.StreamTorrentsToClient = async function (res) {
	res.sseSetup();
	currentTorrentConnections.push(res);
	if (!torrentStreamRunning) {
		StartTorrentStream();
	}
}

var StartTorrentStream = async function() {
	if (!torrentStreamRunning) {
		torrentStreamRunning = true;
		intervalID = setInterval(async function() {
			try {
				await SendTorrentsToConnections();

				if (currentTorrentConnections.length <= 0) {
					throw new Error("No connections remain");
				}
			} catch(err) {
				clearInterval(intervalID);
				torrentStreamRunning = false;
			}
		}, 350);
		SendTorrentsToConnections();
	}
}

var SendTorrentsToConnections = async function()
{
	var torrentsToSend = [];
	var torrents = (await TransmissionWrapper.GetTorrents()).torrents;
	torrents.forEach(torrent => {
		torrent.done = torrent.percentDone == 1;
		torrent.error = torrent.status == TransmissionWrapper.status.STOPPED;
		torrent.downloadRate = Math.round(torrent.rateDownload / 1000) + ' kB/s';
		torrent.progress = torrent.percentDone * 100;
		torrent.eta = Math.round(torrent.eta / 60) + ' Minutes';
		torrentsToSend.push(_.pick(torrent, [
			'done', 'error', 'hashString', 'name', 'id', 'downloadRate', 'progress', 'eta'
		]));
	});

	for (var i = 0; i < currentTorrentConnections.length; i++) {
		var user = currentTorrentConnections[i];
		var success = user.sseSend(torrentsToSend);
		if (!success) {
			_.pull(currentTorrentConnections, user);
		}
	}
}