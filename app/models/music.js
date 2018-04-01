// load the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// define the schema for our Playlist model
var musicSchema = mongoose.Schema({
  _id: Schema.Types.ObjectId,
  author_id: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  url: String,
  file: String,
  title: String,
  artistName: String,
  deezerId: Number,
  itunesId: Number,
  position: Number,
  duration: Number,
  deezerAlbum: Number,
  discNumber: Number,
  album: String,
  releaseDate: Date,
  nbTracks: Number,
  genreId: Number,
  cover: String,
  genre: String,
  creationDate: {
    type: Date,
    default: Date.now
  }
});

musicSchema.statics.isUrlAlreadyDownloaded = function(url, callback) {
  return this.model('Music').find({
    url: url
  }, function(err, res) {
    if (err)
      return callback();

    if (res === undefined)
      return callback(false);

    return callback(true, res);
  });
}

// create the model for playlist and expose it to our app
module.exports = mongoose.model('Music', musicSchema);
