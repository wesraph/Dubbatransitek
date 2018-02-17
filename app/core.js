//load all the thing we need
var alltomp3 = require('alltomp3');
var similarSongs = require('similar-songs');
var CronJob = require('cron').CronJob;
var queue = require('queue');
var mongoose = require('mongoose');
var downloadQueue = queue({
  autostart: true,
  concurrency: 1
});

var removeQueue = queue({
  autostart: true,
  concurrency: 1
});

// load up the playlist model
var Playlist = require('./models/playlist');
var Music = require('./models/music')

var fs = require('fs');
var path = require('path');

// The zip library needs to be instantiated:
var nzip = require('node-zip');

module.exports = function(io, lang, similarSongsOption) {

  // -------------------------------------------------------------------------
  // Function
  // -------------------------------------------------------------------------

  // Get

  function getUrlType(url) {
    var site;

    if (url.indexOf('http') !== -1) {
      if (url.indexOf('youtu') !== -1) {
        if (url.indexOf('?list=') !== -1)
          site = 'youtube playlist';
        else if (url.indexOf('watch') !== -1)
          site = 'youtube';
        else
          site = 'unknown';
      } else if (url.indexOf('soundcloud.com') !== -1) {
        if (url.indexOf('/sets/') !== -1)
          site = 'soundcloud playlist';
        else
          site = 'soundcloud';
      } else if (url.indexOf('spotify.com') !== -1 && url.indexOf('playlist') !== -1)
        site = 'spotify playlist';
      else if (url.indexOf('deezer.com') !== -1 && url.indexOf('playlist') !== -1)
        site = 'deezer playlist';
      else
        site = 'unknown';
    } else {
      site = 'query';
    }
    return site;
  }

  function getSongs(name, callback) {
    Playlist.getPlaylist(name, function(res) {
      callback(res.musics_ids);
    });
  }

  // Add

  function addSongToPlaylist(file, infos, url, userId, playlistName, callback) {
    if (!infos)
      return callback(false, lang.playlist.errorAddingMusic);

    var music = new Music();

    if (infos.title)
      music.title = infos.title;
    if (infos.artistName)
      music.artistName = infos.artistName;
    if (infos.deezerId)
      music.deezerId = infos.deezerId;
    if (infos.itunesId)
      music.itunesId = infos.itunesId;
    if (infos.position)
      music.position = infos.position;
    if (infos.duration)
      music.duration = infos.duration;
    if (infos.deezerAlbum)
      music.deezerAlbum = infos.deezerAlbum;
    if (infos.discNumber)
      music.discNumber = infos.discNumber;
    if (infos.album)
      music.album = infos.album;
    if (infos.releaseDate)
      music.releaseDate = infos.releaseDate;
    if (infos.nbTracks)
      music.nbTracks = infos.nbTracks;
    if (infos.genreId)
      music.genreId = infos.genreId;
    if (infos.cover)
      music.cover = infos.cover;
    if (infos.genre)
      music.genre = infos.genre;

    music.url = url;
    music.file = file;
    music._id = mongoose.Types.ObjectId();

    music.save(function(err) {
      if (err) {
        console.log(err);
        return callback(false, lang.playlist.errorAddingMusic);
      }

      Playlist.addMusicToPlaylist(playlistName, music._id, userId, function(err) {
        if (err) {
          console.log(err);
          return callback(false, lang.playlist.errorAddingMusic);
        }

        return callback(true, lang.playlist.successfullyAddedMusic);
      });
    });
  }

  function addSongFromUrl(playlistName, url, userId, callback, progress) {
    downloadSong(url, function(file, infos) {
      addSongToPlaylist(file, infos, url, userId, playlistName, callback);
    }, progress);
  }

  function addSongsFromUrl(playlistName, url, userId, callback, progress) {
    downloadSongs(url, function(file, infos, urlYt) {
      addSongToPlaylist(file, infos, urlYt, userId, playlistName, callback);
    }, progress);
  }

  function addPlaylist(name, tag, url, userId, callback, progress) {
    var newPlaylist = new Playlist();
    newPlaylist._id = mongoose.Types.ObjectId();
    newPlaylist.name = name;
    newPlaylist.tag = tag.replace(/ ,|, /g, ',').split(',');
    newPlaylist.author_id = userId;

    if (url) {
      switch (getUrlType(url)) {
        case 'youtube':
        case 'soundcloud':
          newPlaylist.save(function(err) {
            if (err) {
              console.log(err);
              return callback(false, lang.playlist.errorCreatingPlaylist);
            }

            addSongFromUrl(name, url, userId, callback, progress);
          });
          break;
        case 'soundcloud playlist':
        case 'youtube playlist':
        case 'spotify playlist':
        case 'deezer playlist':
          newPlaylist.save(function(err) {
            if (err) {
              console.log(err);
              return callback(false, lang.playlist.errorCreatingPlaylist);
            }

            addSongsFromUrl(name, url, userId, callback, progress);
          });
          break;
        case 'query':
          newPlaylist.save(function(err) {
            if (err) {
              console.log(err);
              return callback(false, lang.playlist.errorCreatingPlaylist);
            }

            findAndDownload(url, function(file, infos) {
              if (!file || !infos)
                return callback(false, lang.playlist.errorAddingMusic);

              alltomp3.findVideo(url).then(function(res) {
                addSongToPlaylist(file, infos, res[0].url, userId, name, callback);
              }).catch(function(err) {
                callback(false, lang.playlist.errorAddingMusic);
                console.log('!!!!!!!!!!!!!!!!! ERREUR !!!!!!!!!!!!!!!!!!\n', err);
              });
            }, progress);
          });

          break;
        default:
          return callback(false);
      }

    } else {
      newPlaylist.save(function(err) {
        if (err) {
          console.log(err);
          return callback(false, lang.playlist.errorCreatingPlaylist);
        }

        return callback(true, lang.playlist.successfullyCreatedPlaylist);
      });
    }
  }

  function addSongFromQuery(playlistName, query, userId, callback, progress) {
    findAndDownload(query, function(file, infos) {
      if (!file || !infos)
        return callback(false, lang.playlist.errorAddingMusic);

      alltomp3.findVideo(query).then(function(res) {
        addSongToPlaylist(file, infos, res[0].url, userId, playlistName, callback);
      }).catch(function(err) {
        console.log('!!!!!!!!!!!!!!!!! ERREUR !!!!!!!!!!!!!!!!!!\n', err);
        callback(false, lang.playlist.errorAddingMusic);
      });
    }, progress);
  }

  function forSimilar(foundedSongs, index, songs, callback) {
    if (index >= foundedSongs.length)
      return callback(false, null);

    alltomp3.getCompleteInfosFromURL('https://www.youtube.com/watch?v=' + foundedSongs[index].youtubeId).then(function(infos) {
      if (!infos)
        return forSimilar(foundedSongs, index + 1, songs, callback);

      for (var i = 0; i < songs.length; i++) {
        if ((songs[i].deezerId && infos.deezerId && songs[i].deezerId == infos.deezerId) || (songs[i].url == 'https://www.youtube.com/watch?v=' + foundedSongs[index].youtubeId)) {
          return forSimilar(foundedSongs, index + 1, songs, callback);
        }

        if (i == songs.length - 1) {
          return callback(true, 'https://www.youtube.com/watch?v=' + foundedSongs[index].youtubeId);
        }
      }
    }).catch(function(err) {
      console.log('!!!!!!!!!!!!!!!!! ERREUR !!!!!!!!!!!!!!!!!!\n', err);
    });
  }

  function addSimilar(playlistName, userId, musicId, callback, progress) {
    Music.findOne({
      _id: musicId
    }, function(err, res) {
      if (err) return;

      if (!res) return callback(false, lang.playlist.needToListenFirst);

      similarSongs.find({
        title: res.title,
        artist: res.artistName,
        limit: 10, // defaults to 50
        lastfmAPIKey: similarSongsOption.lastFM.lastfmAPIKey,
        lastfmAPISecret: similarSongsOption.lastFM.lastfmAPISecret,
        youtubeAPIKey: similarSongsOption.youtube.youtubeAPIKey
      }, function(err, foundedSongs) {
        if (err || foundedSongs.length == 0)
          return callback(false, lang.playlist.unableToFindSimilarSong);

        getSongs(playlistName, function(songs) {
          forSimilar(foundedSongs, 0, songs, function(success, url) {
            if (!success)
              return callback(false, lang.playlist.unableToFindSimilarSong);

            addSongFromUrl(playlistName, url, userId, callback, progress);
          });
        });
      });
    });
  }

  // Edit

  function editPlaylistOptions(playlistName, userId, syncImportedPlaylist, autoAddSimilarSong, callback) {
    if (typeof(syncImportedPlaylist, autoAddSimilarSong) == "boolean") {
      Playlist.findOne({
        name: playlistName
      }, function(err, result) {
        if (err)
          return callback(false, lang.playlist.unableToEditOptions);

        if (result.author_id != userId)
          return callback(false, lang.playlist.notOwner);

        Playlist.update({
          name: playlistName
        }, {
          syncImportedPlaylist: syncImportedPlaylist,
          autoAddSimilarSong: autoAddSimilarSong
        }, function(err) {
          if (err)
            return callback(false, lang.playlist.unableToEditOptions);

          return callback(true, lang.playlist.successfullyEditedOptions);
        });
      });
    } else
      return callback(false, lang.playlist.unableToEditOptions);
  }

  // Remove

  function removePlaylist(playlistName, userId, callback) {
    Playlist.findOne({
      name: playlistName
    }, function(err, result) {
      if (err)
        return callback(false, lang.playlist.errorDeletingPlaylist);

      if (result.author_id != userId)
        return callback(false, lang.playlist.notOwner);

      if (result.musics_ids.length == 0) {
        Playlist.remove({
          name: playlistName
        }, function(err) {
          if (err) {
            console.log(err);
            return callback(false, lang.playlist.errorDeletingPlaylist);
          }

          return callback(true, lang.playlist.successfullyDeletedPlaylist);
        });
      } else {
        result.musics_ids.forEach(function(musicId, index) {
          removeQueue.push(function(next) {
            removeSong(playlistName, musicId, userId, function() {
              next();
            });
          });

          if (index == result.musics_ids.length - 1) {
            removeQueue.push(function(next) {
              Playlist.remove({
                name: playlistName
              }, function(err) {
                next();
                if (err) {
                  console.log(err);
                  return callback(false, lang.playlist.errorDeletingPlaylist);
                }

                return callback(true, lang.playlist.successfullyDeletedPlaylist);
              });
            });
          }
        });
      }
    });
  }

  function removeSong(playlistName, musicId, userId, callback) {
    //Search for the playlist where to delete song
    Playlist.findOne({
      name: playlistName
    }, function(err, res) {
      if (err)
        return callback ? callback(false, lang.playlist.errorDeletingPlaylist) : null;

      if (res.author_id != userId)
        return callback ? callback(false, lang.playlist.notOwner) : null;

      //Remove song from this playlist
      Playlist.update({
        name: playlistName
      }, {
        $pull: {
          musics_ids: musicId
        }
      }, {
        safe: true
      }, function(err) {
        if (err)
          return callback ? callback(false, lang.playlist.errorDeletingMusic) : null;

        //Search if the song is used in another playlist
        Playlist.findOne({
          musics_ids: musicId
        }, function(err, res) {
          //If not, remove the file
          if (err) return callback ? callback(false, lang.playlist.errorDeletingMusic) : null;

          if (!res) {
            Music.findOne({
              _id: musicId
            }, function(err, res) {
              if (err) return callback ? callback(false, lang.playlist.errorDeletingMusic) : null;

              fs.unlink(res.file, function() {
                Music.remove({
                  _id: musicId
                }, function(err) {
                  if (err) return callback ? callback(false, lang.playlist.errorDeletingMusic) : null;

                  return callback ? callback(true, lang.playlist.successfullyDeletedMusic) : null;
                });
              });
            });
          } else
            //If yes, do nothing
            return callback ? callback(true, lang.playlist.successfullyDeletedMusic) : null;
        });
      })
    });
  }

  // Download

  function downloadSong(url, callback, progress) {
    alltomp3.getCompleteInfosFromURL(url).then(function(infos) {
      if (infos === undefined || (infos !== undefined && infos.deezerId === undefined)) {
        return downloadQueue.push(function(next) {
          var dl = alltomp3.downloadAndTagSingleURL(url, './public/musics', function(infos) {
            next();
            if (!infos)
              return callback();

            return callback(infos.file, infos.infos, url);
          });

          progress(dl);
        });
      }

      Music.findOne({
        $or: [{
            deezerId: infos.deezerId
          },
          {
            itunesId: infos.deezerId
          },
        ]
      }, function(err, res) {
        if (err) return;

        if (res) return callback(res.file, res, url);

        downloadQueue.push(function(next) {
          var dl = alltomp3.downloadAndTagSingleURL(url, './public/musics', function(infos) {
            next();
            if (!infos)
              return callback();

            return callback(infos.file, infos.infos, url);
          }, '', false, infos);

          progress(dl);
        });
      });
    }).catch(function(err) {
      console.log('!!!!!!!!!!!!!!!!! ERREUR !!!!!!!!!!!!!!!!!!\n', err);
    });
  }

  function downloadSongsFromUrl(url, callback, progress) {
    alltomp3.getPlaylistURLsInfos(url).then(function(array) {
      for (var i = 0; i < array.items.length; i++) {
        //TODO: Async
        downloadSong(array.items[i].url, callback, progress);
      }
    }).catch(function(err) {
      console.log('!!!!!!!!!!!!!!!!! ERREUR !!!!!!!!!!!!!!!!!!\n', err);
    });
  }

  function downloadSongsFromTitle(url, callback, progress) {
    alltomp3.getPlaylistTitlesInfos(url).then(function(array) {
      for (var i = 0; i < array.items.length; i++) {
        findAndDownload(array.items[i].artistName + '-' + array.items[i].title, callback, progress);
      }
    }).catch(function(err) {
      console.log('!!!!!!!!!!!!!!!!! ERREUR !!!!!!!!!!!!!!!!!!\n', err);
    });
  }

  function downloadSongs(url, callback, progress) {
    switch (getUrlType(url)) {
      case 'soundcloud playlist':
      case 'youtube playlist':
        downloadSongsFromUrl(url, callback, progress);
        break;
      case 'spotify playlist':
      case 'deezer playlist':
        downloadSongsFromTitle(url, callback, progress);
        break;
      default:

    }
  }

  function findAndDownload(query, callback, progress) {
    alltomp3.findVideo(query).then(function(res) {
      if (!res)
        return callback();

      downloadSong(res[0].url, callback, progress);
    }).catch(function(err) {
      console.log('!!!!!!!!!!!!!!!!! ERREUR !!!!!!!!!!!!!!!!!!\n', err);
    });
  }

  function downloadPlaylist(name, callback) {
    getSongs(name, function(res) {
      if (!res)
        callback(false, lang.playlist.downloadFail);

      zip = new nzip();
      for (var i = 0; i < res.length; i++) {
        zip.file(res[i].file.split('/').pop(), fs.readFileSync(res[i].file));
      }

      var data = zip.generate({
        base64: false,
        compression: 'DEFLATE'
      });

      // it's important to use *binary* encode
      fs.writeFileSync('./public/playlists/' + name + '.zip', data, 'binary');
      callback(true, lang.playlist.downloadReady);
    });
  }

  // UI

  function progressMessages(dl, socket) {
    if (dl) {
      var urls;

      dl.on('search-end', function() {
        socket.emit('wait', lang.playlist.searchEnd);
      });
      dl.on('download', function(infos) {
        if (infos.progress)
          socket.emit('wait', lang.playlist.download.replace('%d', Math.round(infos.progress)));
      });
      dl.on('download-end', function() {
        socket.emit('wait', lang.playlist.downloadEnd);
      });
      dl.on('convert', function(infos) {
        if (infos.progress)
          socket.emit('wait', lang.playlist.convert.replace('%d', Math.round(infos.progress)));
      });
      dl.on('convert-end', function() {
        socket.emit('wait', lang.playlist.convertEnd);
      });
      dl.on('begin-url', function(index) {
        socket.emit('wait', lang.playlist.beginUrl.replace('%d', index + 1));
      });
      dl.on('end-url', function(index) {
        socket.emit('wait', lang.playlist.beginUrl.replace('%d', index + 1));
      });
      dl.on('end', function() {
        socket.emit('wait', lang.playlist.end, true);
      });
      dl.on('playlist-infos', function(urlss) {
        urls = urlss;
      });
      dl.on('error', function(error) {
        console.log('!!!!!!!!!!!!!!!!! ERREUR !!!!!!!!!!!!!!!!!!\n', error);
      })
    } else {
      socket.emit('wait', lang.playlist.end, true);
    }
  }

  function playlistCreationChecker(name, userID, callback) {
    if (name == null) {
      return callback(false, lang.playlist.noPlaylistName);
    }

    if (userID == null) {
      return callback(false, lang.playlist.sessionExpired);
    }

    Playlist.find({
      name: name
    }, function(err, pl) {
      if (err) {
        return callback(false, lang.playlist.errorDB);
      }

      if (pl.length) {
        return callback(false, lang.playlist.playlistNameAlreadyTaken);
      } else {
        callback(true);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Not function
  // -------------------------------------------------------------------------
  io.on('connection', function(socket) {
    socket.on('getAllPlaylists', function() {
      Playlist.getAllPlaylists(function(res) {
        socket.emit('allPlaylists', res);
      })
    });

    socket.on('getMyPlaylists', function() {
      if (!socket.request.session.passport.user) {
        return socket.emit('fail', lang.playlist.sessionExpired);
      }

      Playlist.getUserPlaylists(socket.request.session.passport.user, function(res) {
        socket.emit('myPlaylists', res);
      });
    });

    socket.on('getSongs', function(name) {
      getSongs(name, function(infos) {
        if (infos)
          socket.emit('songs(' + name + ')', infos);
      });
    });

    socket.on('getPlaylistInfo', function(name) {
      Playlist.getPlaylistInfo(name, function(syncImportedPlaylist, autoAddSimilarSong) {
        socket.emit('playlistInfo(' + name + ')', syncImportedPlaylist, autoAddSimilarSong);
      });
    });

    socket.on('downloadPlaylist', function(name) {
      socket.emit('wait', lang.playlist.waitUntilDownloadReady);
      downloadPlaylist(name, function(success, msg) {
        socket.emit('wait', lang.playlist.waitUntilDownloadReady, true);
        if (success) {
          socket.emit('success', msg);
          socket.emit('downloadReady');
        } else
          socket.emit('fail', msg);
      });
    });

    socket.on('addPlaylist', function(name, tag, url) {
      playlistCreationChecker(name, socket.request.session.passport.user, function(canCreate, msg1) {
        if (!canCreate) {
          return socket.emit('fail', msg1);
        }

        addPlaylist(name, tag, url, socket.request.session.passport.user, function(success, msg2) {
          if (!success)
            return socket.emit('fail', msg2);

          Playlist.getUserPlaylists(socket.request.session.passport.user, function(res) {
            socket.emit('myPlaylists', res);
          });

          return socket.emit('success', msg2);
        }, function(dl) {
          progressMessages(dl, socket);
        });
      });
    });

    socket.on('addSong', function(playlistName, url) {
      if (!socket.request.session.passport.user) {
        return socket.emit('fail', lang.playlist.sessionExpired);
      }

      switch (getUrlType(url)) {
        case 'youtube':
        case 'soundcloud':
          addSongFromUrl(playlistName, url, socket.request.session.passport.user, function(success, msg) {
            if (!success)
              return socket.emit('fail', msg);

            getSongs(playlistName, function(infos) {
              socket.emit('songs(' + playlistName + ')', infos);
              socket.broadcast.emit('songs(' + playlistName + ')', infos);
            });

            return socket.emit('success', msg);

          }, function(dl) {
            progressMessages(dl, socket);
          });
          break;
        case 'soundcloud playlist':
        case 'youtube playlist':
        case 'spotify playlist':
        case 'deezer playlist':
          addSongsFromUrl(playlistName, url, socket.request.session.passport.user, function(success, msg) {
            if (!success)
              return socket.emit('fail', msg);

            getSongs(playlistName, function(infos) {
              socket.emit('songs(' + playlistName + ')', infos);
              socket.broadcast.emit('songs(' + playlistName + ')', infos);
            });

            return socket.emit('success', msg);

          }, function(dl) {
            progressMessages(dl, socket);
          });
          break;
        case 'query':
          addSongFromQuery(playlistName, url, socket.request.session.passport.user, function(success, msg) {
            if (!success)
              return socket.emit('fail', msg);

            getSongs(playlistName, function(infos) {
              socket.emit('songs(' + playlistName + ')', infos);
              socket.broadcast.emit('songs(' + playlistName + ')', infos);
            });

            return socket.emit('success', msg);
          }, function(dl) {
            progressMessages(dl, socket);
          });
          break;
        default:
          return socket.emit('fail', lang.playlist.errorImportingPlaylist);
      }
    });

    socket.on('addSimilar', function(playlistName, musicId) {
      if (!socket.request.session.passport.user) {
        return socket.emit('fail', lang.playlist.sessionExpired);
      }

      if (musicId == null) {
        return socket.emit('fail', lang.playlist.needToListenFirst);
      }

      addSimilar(playlistName, socket.request.session.passport.user, musicId, function(success, msg) {
        if (!success)
          return socket.emit('fail', msg);

        getSongs(playlistName, function(infos) {
          socket.emit('songs(' + playlistName + ')', infos);
          socket.broadcast.emit('songs(' + playlistName + ')', infos);
        });
        return socket.emit('success', msg);
      }, function(dl) {
        progressMessages(dl, socket);
      })
    });

    socket.on('removePlaylist', function(name, tag, url) {
      if (!socket.request.session.passport.user)
        return socket.emit('fail', lang.playlist.sessionExpired);

      removePlaylist(name, socket.request.session.passport.user, function(success, msg) {
        if (success)
          socket.emit('success', msg);
        else
          socket.emit('fail', msg);
      });
    });

    socket.on('removeSong', function(playlistName, musicId, index) {
      if (!socket.request.session.passport.user)
        return socket.emit('fail', lang.playlist.sessionExpired);

      removeSong(playlistName, musicId, socket.request.session.passport.user, function(success, msg) {
        if (success) {
          socket.emit('success', msg);
          getSongs(playlistName, function(infos) {
            if (infos) {
              socket.emit('songs(' + playlistName + ')', infos, index);
              socket.broadcast.emit('songs(' + playlistName + ')', infos, index);
            }
          });
        } else
          socket.emit('fail', msg);
      });
    });

    socket.on('editPlaylistOptions', function(playlistName, syncImportedPlaylist, autoAddSimilarSong) {
      if (!socket.request.session.passport.user)
        return socket.emit('fail', lang.playlist.sessionExpired);

      editPlaylistOptions(playlistName, socket.request.session.passport.user, syncImportedPlaylist, autoAddSimilarSong, function(success, msg) {
        if (!success) {
          return socket.emit('fail', msg);
        }

        socket.emit('playlistInfo(' + playlistName + ')', syncImportedPlaylist, autoAddSimilarSong);
        socket.broadcast.emit('playlistInfo(' + playlistName + ')', syncImportedPlaylist, autoAddSimilarSong);
        socket.emit('success', msg);
      });
    });

  });

  new CronJob('0 0 * * *', function() {
    Playlist.getAllPlaylists(function(err, res) {
      if (err || !res)
        return;

      res.forEach(function(playlist) {
        if (playlist.syncImportedPlaylist == true) {
          playlist.importedPl.forEach(function(urlImportedPl) {

            downloadSongs(urlImportedPl, function(file, infos, urlYt) {
              Music.findOne({
                url: urlYt
              }, function(err, res) {
                if (err) return;

                if (res) return;

                addSongToPlaylist(file, infos, urlYt, playlist.author_id, playlist.name, function(a) {

                });
              });
            }, function(a) {

            });
          });
        }
      });
    });
  }, null, true, 'Europe/Paris');
};
