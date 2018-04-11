require('./config/config');

const express = require('express'),
	bodyParser = require('body-parser'),
	_ = require('lodash'),
	path = require('path');

var {ObjectID} = require('mongodb');
var {mongoose} = require('./db/mongoose');
var {Clip} = require('./models/Show');

const SERVER_PORT = process.env.PORT;

var app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// =======================================================================
// ------ ROUTES
// ------ GET

// ------ POST

// ------ PATCH

app.listen(SERVER_PORT, function(err) {
	if (err) {
		return console.log(err);
	}

	console.log('Listening on port', SERVER_PORT);
});