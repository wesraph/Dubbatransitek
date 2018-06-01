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

  function compare(a, b) {
    let comparison = 0;

    if (a.index > b.index) {
      comparison = 1;
    } else if (b.index > a.index) {
      comparison = -1;
    }

    return comparison;
  }

  function getSongs(name, callback) {
    Playlist.getPlaylist(name, function(res) {
      if (res && res.length != 0)
        callback(res.musics.sort(compare));
    });
  }

  // Add

  function addSongToPlaylist(file, infos, url, userId, playlistName, callback) {
    if (!infos)
      return callback(false, lang.playlist.errorAddingMusic);

    if (infos._id) {
      return Playlist.getPlaylist(playlistName, function(res) {
        return Playlist.addMusicToPlaylist(playlistName, infos._id, userId, res.musics.length, function(err) {
          if (err) {
            console.log(err);
            return callback(false, lang.playlist.errorAddingMusic);
          }

          return callback(true, lang.playlist.successfullyAddedMusic);
        });
      });
    }

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

    music.author_id = userId;
    music.url = url;
    music.file = file;
    music._id = mongoose.Types.ObjectId();

    music.save(function(err) {
      if (err) {
        console.log(err);
        return callback(false, lang.playlist.errorAddingMusic);
      }

      Playlist.getPlaylist(playlistName, function(res) {
        Playlist.addMusicToPlaylist(playlistName, music._id, userId, res.musics.length, function(err) {
          if (err) {
            console.log(err);
            return callback(false, lang.playlist.errorAddingMusic);
          }

          return callback(true, lang.playlist.successfullyAddedMusic);
        });
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

  function addPlaylist(name, tag, url, userId, plCreated, callback, progress) {
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
            plCreated();
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
            plCreated();
            addSongsFromUrl(name, url, userId, callback, progress);
          });
          break;
        case 'query':
          newPlaylist.save(function(err) {
            if (err) {
              console.log(err);
              return callback(false, lang.playlist.errorCreatingPlaylist);
            }
            plCreated();
            findAndDownload(url, function(file, infos) {
              if (!file || !infos)
                return callback(false, lang.playlist.errorAddingMusic);

              alltomp3.findVideo(url).then(function(res) {
                return addSongToPlaylist(file, infos, res[0].url, userId, name, callback);
              }).catch(function(err) {
                console.log('Error when finding Video: ' + XMLHttpRequesturl, err);
                return callback(false, lang.playlist.errorAddingMusic);
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
        return addSongToPlaylist(file, infos, res[0].url, userId, playlistName, callback);
      }).catch(function(err) {
        console.log('Error when finding Video from query:', query, err);
        return callback(false, lang.playlist.errorAddingMusic);
      });
    }, progress);
  }

  function forSimilar(foundedSongs, index, callback) {
    if (index >= foundedSongs.length)
      return callback(false, null);

    var urlYt = 'https://www.youtube.com/watch?v=' + foundedSongs[index].youtubeId;

    Music.isUrlAlreadyDownloaded(urlYt, function(itis) {
      if (itis)
        return forSimilar(foundedSongs, index + 1, callback);

      alltomp3.getCompleteInfosFromURL(urlYt).then(function(infos) {
        if (!infos)
          return forSimilar(foundedSongs, index + 1, callback);

        var searchParams = [{
          url: urlYt
        }];

        if (infos.deezerId)
          searchParams.push({
            deezerId: infos.deezerId
          });
        if (infos.ituneId)
          searchParams.push({
            itunesId: infos.ituneId
          });

        return Music.findOne({
          $or: searchParams
        }, function(err, res) {
          if (err || res === undefined || res == null || (res != null && res.length == 0))
            return callback(true, urlYt);

          return forSimilar(foundedSongs, index + 1, callback);
        });
      }).catch(function(err) {
        console.log('Error when getting info from URL:', urlYt, err);
        return callback(false, null);
      });
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

        forSimilar(foundedSongs, 0, function(success, url) {
          if (!success)
            return callback(false, lang.playlist.unableToFindSimilarSong);

          addSongFromUrl(playlistName, url, userId, callback, progress);
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

  function changeIndexes(playlistName, userId, oldIndex, newIndex, callback) {
    if (Number.isInteger(oldIndex) && oldIndex > -1 && Number.isInteger(newIndex) && newIndex > -1) {
      Playlist.findOne({
        name: playlistName
      }, function(err, res) {
        if (err)
          return callback(false, lang.playlist.unableToEditOptions);

        if (res.author_id != userId)
          return callback(false, lang.playlist.notOwner);

        var musics = JSON.parse(JSON.stringify(res.musics));

        if (newIndex < oldIndex) {
          for (var i = 0; i < res.musics.length; i++) {
            if (res.musics[i].index == oldIndex)
              musics[i].index = newIndex;

            if (res.musics[i].index >= newIndex && res.musics[i].index < oldIndex)
              musics[i].index += 1;
          }
        }

        if (newIndex > oldIndex) {
          for (var i = 0; i < res.musics.length; i++) {
            if (res.musics[i].index == oldIndex)
              musics[i].index = newIndex;

            if (res.musics[i].index <= newIndex && res.musics[i].index > oldIndex)
              musics[i].index -= 1;
          }
        }

        Playlist.update({
          name: playlistName
        }, {
          musics: musics
        }, function(err) {
          if (err)
            return callback(false, lang.playlist.unableToEditOptions);

          return callback(true, lang.playlist.successfullyEditedOptions);
        });
      })
    } else
      return callback(false, lang.playlist.unableToEditOptions);
  }

  // Remove
  // BUG Not deleting songs
  function removePlaylist(playlistName, userId, callback) {
    Playlist.findOne({
      name: playlistName
    }, function(err, result) {
      if (err)
        return callback(false, lang.playlist.errorDeletingPlaylist);

      if (result.author_id != userId)
        return callback(false, lang.playlist.notOwner);

      if (result.musics.length == 0) {
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
        result.musics.forEach(function(music, index) {
          removeQueue.push(function(next) {
            removeSong(playlistName, music.music_id, userId, function() {
              next();
            });
          });

          if (index == result.musics.length - 1) {
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

      var musics = JSON.parse(JSON.stringify(res.musics));
      var fakeIndexToRemove;
      var i;

      for (i = 0; i < musics.length; i++) {
        if (res.musics[i].music_id == musicId) {
          console.log(res.musics[i]);
          fakeIndexToRemove = res.musics[i].index;
          break;
        }
      }

      if (i == musics.length)
        return callback ? callback(false, lang.playlist.errorDeletingMusic) : null;

      musics.splice(i, 1);

      for (i = 0; i < musics.length; i++) {
        if (musics[i].index > fakeIndexToRemove) {
          musics[i].index -= 1;
        }
      }

      //Remove song from this playlist
      Playlist.update({
        name: playlistName
      }, {
        musics: musics
      }, {
        safe: true
      }, function(err) {
        if (err)
          return callback ? callback(false, lang.playlist.errorDeletingMusic) : null;

        //Search if the song is used in another playlist
        Playlist.findOne({
          'musics.music_id': musicId
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
    Music.isUrlAlreadyDownloaded(url, function(itis, res) {
      if (itis === undefined) return callback();

      if (itis) return callback(res.file, res, url);

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

        var searchParams = [{
          url: url
        }];

        if (infos.deezerId)
          searchParams.push({
            deezerId: infos.deezerId
          });
        if (infos.ituneId)
          searchParams.push({
            itunesId: infos.ituneId
          });

        return Music.findOne({
          $or: searchParams
        }, function(err, res) {
          if (err) return callback();

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
        console.log('Error when getting info from URL', url, err);
        return calback();
      });
    })
  }

  function downloadSongsFromUrl(url, callback, progress) {
    alltomp3.getPlaylistURLsInfos(url).then(function(array) {
      for (var i = 0; i < array.items.length; i++) {
        downloadSong(sanitizeUrl(array.items[i].url), callback, progress);
      }
      return;
    }).catch(function(err) {
      console.log('Error when getting infos from playlist URL:', url, err);
      return callback();
    });
  }

  function downloadSongsFromTitle(url, callback, progress) {
    alltomp3.getPlaylistTitlesInfos(url).then(function(array) {
      for (var i = 0; i < array.items.length; i++) {
        findAndDownload(array.items[i].artistName + ' - ' + array.items[i].title, callback, progress);
      }
      return;
    }).catch(function(err) {
      console.log('Error when getting infos from playlist titles:', url, err);
      return callback();
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
        callback();
        break;
    }
  }

  function findAndDownload(query, callback, progress) {
    alltomp3.findVideo(query).then(function(res) {
      if (!res)
        return callback();

      return downloadSong(res[0].url, callback, progress);
    }).catch(function(err) {
      console.log('Error when finding video from query:', query, err);
      return callback();
    });
  }

  function downloadPlaylist(name, callback) {
    Playlist.getPlaylist(name, function(res) {
      if (res === undefined || res == null || (res != null && res.length == 0))
        callback(false, lang.playlist.downloadFail);

      if (res.isZipped)
        return callback(true, lang.playlist.downloadReady);

      zip = new nzip();
      for (var i = 0; i < res.musics.length; i++) {
        zip.file(res.musics[i].music_id.file.split('/').pop(), fs.readFileSync(res.musics[i].music_id.file));
      }

      var data = zip.generate({
        base64: false,
        compression: 'DEFLATE'
      });

      // it's important to use *binary* encode
      fs.writeFileSync(path.join('./public/playlists', name + '.zip'), data, 'binary');

      Playlist.update({
        name: name
      }, {
        isZipped: true
      }, function(err) {
        callback(true, lang.playlist.downloadReady);
      });
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
        console.log('Error when downloading\n', error);
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

  function sanitizeUrl(url) {
    return url.replace(/(http)(s)?\:\/\//, "https://");
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

        addPlaylist(name, tag, sanitizeUrl(url), socket.request.session.passport.user, function() {
          Playlist.getUserPlaylists(socket.request.session.passport.user, function(res) {
            socket.emit('myPlaylists', res);
            socket.broadcast.emit('myPlaylists', res);
          });

          return socket.emit('success', lang.playlist.successfullyCreatedPlaylistWaitForSong);
        }, function(success, msg2) {
          if (!success)
            return socket.emit('fail', msg2);

          Playlist.getUserPlaylists(socket.request.session.passport.user, function(res) {
            socket.emit('myPlaylists', res);
            socket.broadcast.emit('myPlaylists', res);
          });

          getSongs(name, function(infos) {
            socket.broadcast.emit('songs(' + name + ')', infos);
          });

          return socket.emit('success', msg2);
        }, function(dl) {
          progressMessages(dl, socket);
        });
      });
    });

    socket.on('addSong', function(playlistName, uri) {
      if (!socket.request.session.passport.user) {
        return socket.emit('fail', lang.playlist.sessionExpired);
      }

      url = sanitizeUrl(uri);
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

    socket.on('removePlaylist', function(name) {
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

    socket.on('changeIndexes', function(playlistName, oldIndex, newIndex) {
      if (!socket.request.session.passport.user)
        return socket.emit('fail', lang.playlist.sessionExpired);

      changeIndexes(playlistName, socket.request.session.passport.user, oldIndex, newIndex, function(success, msg) {
        if (!success) {
          return socket.emit('fail', msg);
        }

        socket.emit('success', msg);
        getSongs(playlistName, function(infos) {
          if (infos) {
            socket.emit('songs(' + playlistName + ')', infos);
            socket.broadcast.emit('songs(' + playlistName + ')', infos);
          }
        });
      });
    })
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
