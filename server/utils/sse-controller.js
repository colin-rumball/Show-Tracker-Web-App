var TransmissionWrapper = require('./transmission-wrapper');
const _ = require('lodash');

var currentConnections = [];
var streamRunning = false;
var intervalID;

module.exports.StreamTorrentsToClient = async function (res) {
	res.sseSetup();
	currentConnections.push(res);
	if (!streamRunning) {
		StartStream();
	}
}

var StartStream = async function() {
	if (!streamRunning) {
		streamRunning = true;
		intervalID = setInterval(async function() {
			try {
				var torrents = (await TransmissionWrapper.GetTorrents()).torrents;
				torrents.forEach(torrent => {
					torrent.downloadRate = Math.round(torrent.rateDownload / 1000) + ' kB/s';
					torrent.progress = torrent.percentDone * 100;
					torrent.eta = Math.round(torrent.eta / 60) + ' Minutes';
				});

				for (var i = 0; i < currentConnections.length; i++) {
					var user = currentConnections[i];
					var success = user.sseSend(torrents);
					if (!success) {
						_.pull(currentConnections, user);
					}
				}

				if (currentConnections.length <= 0) {
					throw new Error("No connections remain");
				}
			} catch(err) {
				clearInterval(intervalID);
				streamRunning = false;
			}
		}, 500);
	}
}