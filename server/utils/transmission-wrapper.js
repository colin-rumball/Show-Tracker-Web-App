const transmission = require('transmission');

var transmissionClient = new transmission({
	host: process.env.BITTORRENT_IP,
	port: process.env.BITTORRENT_PORT,
	username: process.env.BITTORRENT_USER,
	password: process.env.BITTORRENT_PASS
});

function TransmissionWrapper(){}

TransmissionWrapper.prototype.GetTorrents = async function() {
    return new Promise(async (resolve, reject) => {
        transmissionClient.get(async function (err, arg) {
            if (err) {
                return reject(err);
            }
    
            resolve(arg);
            arg.torrents.forEach(torrent => {
                torrent.downloadRate = Math.round(torrent.rateDownload / 1000) + ' kB/s';
                torrent.progress = torrent.percentDone * 100;
                torrent.eta = Math.round(torrent.eta / 60) + ' Minutes';
            });
    
            res.render('pages/torrents', {
                torrents: arg.torrents
            });
        }); 
	});
}

TransmissionWrapper.prototype.AddUrl = async function(magnetLink) {
    return new Promise(async (resolve, reject) => {
        transmissionClient.addUrl(magnetLink, function(err, arg) {
            if (err) {
                return reject(err);
            }
    
            resolve(arg);
        });
	});
}

TransmissionWrapper.prototype.RemoveTorrent = async function(torrentId) {
    return new Promise(async (resolve, reject) => {
        transmissionClient.remove([torrentId], function (err) {
			if (err) {
				return reject(err);
			}
			resolve();
		});
	});
}

TransmissionWrapper.prototype.status = transmissionClient.status;

module.exports = {
    TransmissionWrapper
}