// load the things we need
var mongoose = require('mongoose');

// define the schema for our Playlist model
var playlistSchema = mongoose.Schema({
    name: String,
    author_id: String,
    contributor_id: [String],
    tag: [String],
    importedPl: [String],
    musics: [{
        url: String,
        file: String,
        infos: Object
    }],
    syncImportedPlaylist: {
        type: Boolean,
        default: false
    },
    autoAddSimilarSong: {
        type: Boolean,
        default: false
    },
    creationDate: {
        type: Date,
        default: Date.now
    }
});

// create the model for playlist and expose it to our app
module.exports = mongoose.model('Playlist', playlistSchema);
