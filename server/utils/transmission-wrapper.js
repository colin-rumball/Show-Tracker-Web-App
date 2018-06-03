const transmission = require('transmission');

var transmissionClient = new transmission({
	host: process.env.BITTORRENT_IP,
	port: process.env.BITTORRENT_PORT,
	username: process.env.BITTORRENT_USER,
	password: process.env.BITTORRENT_PASS
});

var activeRequest = false;

module.exports.Ping = async function () {
	return new Promise(async (resolve, reject) => {
		this.GetTorrents().then((torrents) => {
			resolve(true);
		}).catch((err) => {
			reject(err);
		});
	});
}

module.exports.GetTorrents = async function() {
    return new Promise(async (resolve, reject) => {
        transmissionClient.get(async function (err, arg) {
            if (err) {
                return reject(err);
            }
    
            resolve(arg);
        }); 
	});
}

module.exports.AddUrl = async function(magnetLink) {
    return new Promise(async (resolve, reject) => {
        transmissionClient.addUrl(magnetLink, function(err, arg) {
            if (err) {
                return reject(err);
            }
    
            resolve(arg);
        });
	});
}

module.exports.RemoveTorrent = async function(torrentId) {
    return new Promise(async (resolve, reject) => {
        transmissionClient.remove([torrentId], function (err) {
			if (err) {
				return reject(err);
			}
			resolve();
		});
	});
}

module.exports.StopAll = async function () {
	return new Promise(async (resolve, reject) => {
		var torrents = (await this.GetTorrents()).torrents;
		var torrentIds = torrents.map(torrent => torrent.id);
		transmissionClient.stop(torrentIds, function (err) {
			if (err) {
				return reject(err);
			}
			resolve();
		});
	});
}

module.exports.StartAll = async function () {
	return new Promise(async (resolve, reject) => {
		var torrents = (await this.GetTorrents()).torrents;
		var torrentIds = torrents.map(torrent => torrent.id);
		transmissionClient.startNow(torrentIds, function (err) {
			if (err) {
				return reject(err);
			}
			resolve();
		});
	});
}

module.exports.status = transmissionClient.status;