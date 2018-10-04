const fs = require('fs-extra'),
    path = require('path');
const PATH_TO_NEW_FILES = path.join('E:/_NEW DOWNLOADS'),
    PATH_TO_TV_SHOWS = path.join('D:/_ON GOING TV SHOWS'),
    PATH_TO_MOVIES = path.join('E:/_NEW MOVIES');

async function MoveFile(file, destination, type) {
	var orgFilePath = path.join(PATH_TO_NEW_FILES, file);
	var fileExists = await fs.exists(orgFilePath);
	if (fileExists) {
		// it exists so it's time to move it
		var newFilePath = type == 'tvshow' ? path.join(PATH_TO_TV_SHOWS, destination) : path.join(PATH_TO_MOVIES, destination);
		try {
			await fs.copy(orgFilePath, newFilePath);
			orgFilePath = replaceAll(orgFilePath, '/', '\\');
			await fs.remove(orgFilePath.substring(0, orgFilePath.lastIndexOf('\\')));
		} catch(err) {
            console.log(`Something went wrong while trying to move ${file} of type ${type} to ${destination} ... Error: ${err}`);
		}
	}
}

function replaceAll(source, search, replacement) {
	return source.replace(new RegExp(search, 'g'), replacement);
};

module.exports = MoveFile;