// load the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
// load up the music model
var Music = require('./music');

// define the schema for our Playlist model
var playlistSchema = mongoose.Schema({
  _id: Schema.Types.ObjectId,
  name: String,
  author_id: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  contributor_id: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  tag: [String],
  importedPl: [String],
  musics: [{
    music_id: {
      type: Schema.Types.ObjectId,
      ref: 'Music'
    },
    index: Number,
    contributor_id: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
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

playlistSchema.statics.getAllPlaylists = function(callback) {
  return this.model('Playlist').find({})
    .populate('author_id', 'local.username + spotify.username + deezer.username + youtube.displayName')
    .populate('musics.contributor_id', 'local.username + spotify.username + deezer.username + youtube.displayName')
    .exec(function(err, res) {
      if (err)
        return;

      callback(res);
    });
}

playlistSchema.statics.getUserPlaylists = function(userId, callback) {
  return this.model('Playlist').find({
    author_id: userId
  }).populate('musics.music_id').exec(function(err, res) {
    if (err)
      return;

    callback(res);
  })
}

playlistSchema.statics.getPlaylist = function(playlistName, callback) {
  return this.model('Playlist').findOne({
      name: playlistName
    }).populate('author_id', 'local.username + spotify.username + deezer.username + youtube.displayName')
    .populate('musics.contributor_id', 'local.username + spotify.username + deezer.username + youtube.displayName')
    .populate({
      path: 'musics.music_id',
      populate: {
        path: 'author_id',
        select: 'local.username + spotify.username + deezer.username + youtube.displayName'
      }
    }).exec(function(err, res) {
      if (err) return;

      callback(res);
    });
}

playlistSchema.statics.getPlaylistInfo = function(playlistName, callback) {
  return this.model('Playlist').findOne({
    name: playlistName
  }, function(err, result) {
    if (err)
      return;

    return callback(result.syncImportedPlaylist, result.autoAddSimilarSong, result.saveAutoAddedSimilarSong);
  });
}

playlistSchema.statics.addMusicToPlaylist = function(playlistName, musicId, userId, callback) {
  return this.getPlaylist(playlistName, function(res) {
    return this.model('Playlist').update({
      name: playlistName
    }, {
      $addToSet: {
        musics: {
          music_id: musicId,
          contributor_id: userId,
          index: res.musics.length
        }
      }
    }, callback);
  });
}

// create the model for playlist and expose it to our app
module.exports = mongoose.model('Playlist', playlistSchema);
