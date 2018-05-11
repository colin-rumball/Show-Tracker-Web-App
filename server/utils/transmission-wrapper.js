const transmission = require('transmission');

var transmissionClient = new transmission({
	host: process.env.BITTORRENT_IP,
	port: process.env.BITTORRENT_PORT,
	username: process.env.BITTORRENT_USER,
	password: process.env.BITTORRENT_PASS
});

var activeRequest = false;

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

module.exports.status = transmissionClient.status;