var mongoose = require('mongoose');

var Clip = mongoose.model('Clip', {
    tape_id: {
        type: Number,
        required: true
    },
    clip_id: {
        type: Number,
        required: true
    },
    file_name: {
        type: String,
        required: true,
        trim: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    year: {
        type: Number,
        required: true
    },
    location: {
        type: String,
        required: true,
        trim: true
    },
    members: {
        type: Array,
        trim: true
    },
    rating: {
        type: Number,
        default: null
    },
    youtube_id: {
        type: String,
        default: null
    },
    tags: {
        type: Array
	},
	state: {
		type: String,
		required: true
	}
});

module.exports = {
    Clip
};