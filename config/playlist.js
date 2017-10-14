//load all the thing we need
var alltomp3 = require('alltomp3');
var similarSongs = require('similar-songs');
var CronJob = require('cron').CronJob;
var queue = require('queue');
var q = queue({
    autostart: true,
    concurrency: 1
});

var r = queue({
    autostart: true,
    concurrency: 1
});

// load up the playlist model
var Playlist = require('../app/models/playlist');

var fs = require('fs');
var path = require('path');

// The zip library needs to be instantiated:
var nzip = require('node-zip');

module.exports = function(io, lang, similarSongsOption) {

    // -------------------------------------------------------------------------
    // Function
    // -------------------------------------------------------------------------

    // Get

    function getAllPlaylists(callback) {
        Playlist.find({}, function(err, result) {
            if (err)
                return;

            return callback(result);
        });
    }

    function getMyPlaylists(userId, callback) {
        Playlist.find({
            author_id: userId
        }, function(err, result) {
            if (err)
                return;

            return callback(result);
        });
    }

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
        Playlist.find({
            name: name
        }, function(err, result) {
            if (err)
                return;

            if (!result[0].musics)
                return callback();

            return callback(result[0].musics);
        });
    }

    function getPlaylistInfo(playlistName, callback) {
        Playlist.find({
            name: playlistName
        }, function(err, result) {
            if (err)
                return;

            return callback(result[0].syncImportedPlaylist, result[0].autoAddSimilarSong, result[0].saveAutoAddedSimilarSong);
        });
    }

    // Add

    function addSongFromUrl(playlistName, url, userId, callback, progress) {
        downloadSong(url, function(file, infos) {
            if (!infos)
                return callback(false, lang.playlist.errorAddingMusic);

            Playlist.update({
                name: playlistName
            }, {
                $addToSet: {
                    musics: {
                        url: url,
                        file: file,
                        infos: infos
                    },
                    contributor_id: userId
                }
            }, function(err) {
                if (err) {
                    console.log(err);
                    return callback(false, lang.playlist.errorAddingMusic);
                }

                return callback(true, lang.playlist.successfullyAddedMusic);
            });
        }, progress);
    }

    function addSongsFromUrl(playlistName, url, userId, callback, progress) {
        downloadSongs(url, function(file, infos, urlYt) {
            if (!file)
                return callback(false, lang.playlist.errorAddingMusic);

            Playlist.update({
                name: playlistName
            }, {
                $addToSet: {
                    contributor_id: userId,
                    importedPl: url,
                    musics: {
                        url: urlYt === undefined ? url : urlYt,
                        file: file,
                        infos: infos
                    }
                }
            }, function(err) {
                if (err)
                    return callback(false, lang.playlist.errorAddingMusic);

                return callback(true, lang.playlist.successfullyAddedMusic);
            });

        }, progress);
    }

    function addPlaylist(name, tag, url, userId, callback, progress) {
        var newPlaylist = new Playlist();
        newPlaylist.name = name;
        newPlaylist.tag = tag.replace(/ ,|, /g, ',').split(',');
        newPlaylist.author_id = userId;

        if (url) {
            switch (getUrlType(url)) {
                case 'youtube':
                case 'soundcloud':
                    downloadSong(url, function(file, infos) {
                        if (!infos)
                            return callback(false, lang.playlist.errorAddingMusic);

                        newPlaylist.musics = [{
                            url: url,
                            file: file,
                            infos: infos
                        }];

                        newPlaylist.save(function(err) {
                            if (err) {
                                console.log(err);
                                return callback(false, lang.playlist.errorCreatingPlaylist);
                            }

                            return callback(true, lang.playlist.successfullyCreatedPlaylist);
                        });

                        return callback(true, lang.playlist.successfullyAddedMusic);
                    }, progress);
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
                    findAndDownload(url, function(file, infos) {
                        if (!file || !infos)
                            return callback(false, lang.playlist.errorAddingMusic);

                        alltomp3.findVideo(url).then(function(res) {
                            newPlaylist.musics = [{
                                url: res[0].url,
                                file: file,
                                infos: infos
                            }];

                            newPlaylist.save(function(err) {
                                if (err) {
                                    console.log(err);
                                    return callback(false, lang.playlist.errorCreatingPlaylist);
                                }

                                return callback(true, lang.playlist.successfullyCreatedPlaylist);
                            });
                        }).catch(function(err) {
                            callback(false, lang.playlist.errorAddingMusic);
                            console.log('!!!!!!!!!!!!!!!!! ERREUR !!!!!!!!!!!!!!!!!!\n', err);
                        });
                    }, progress);
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
                Playlist.update({
                    name: playlistName
                }, {
                    $addToSet: {
                        musics: {
                            url: res[0].url,
                            file: file,
                            infos: infos
                        },
                        contributor_id: userId
                    }
                }, function(err) {
                    if (err) {
                        console.log(err);
                        return callback(false, lang.playlist.errorAddingMusic);
                    }

                    return callback(true, lang.playlist.successfullyAddedMusic);
                });
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
                if (songs[i].infos.deezerId && infos.deezerId && songs[i].infos.deezerId == infos.deezerId) {
                    return forSimilar(foundedSongs, index + 1, songs, callback);
                }

                if (songs[i].infos.spotifyId && infos.spotifyId && songs[i].infos.spotifyId == infos.spotifyId) {
                    return forSimilar(foundedSongs, index + 1, songs, callback);
                }
            }

            return callback(true, 'https://www.youtube.com/watch?v=' + foundedSongs[index].youtubeId);
        }).catch(function(err) {
            console.log('!!!!!!!!!!!!!!!!! ERREUR !!!!!!!!!!!!!!!!!!\n', err);
        });
    }

    function addSimilar(playlistName, userId, index, callback, progress) {
        getSongs(playlistName, function(songs) {
            if (!songs)
                return callback(false, lang.playlist.needToListenFirst);

            if (index >= songs.length)
                return callback(false, lang.playlist.unableToFindSimilarSong);

            similarSongs.find({
                title: songs[index].infos.title,
                artist: songs[index].infos.artistName,
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
                //addSongFromUrl(playlistName, 'https://www.youtube.com/watch?v=' + foundedSongs[0].youtubeId, userId, callback, progress);
            });
        });
    }

    // Edit

    function editPlaylistOptions(playlistName, userId, syncImportedPlaylist, autoAddSimilarSong, callback) {
        if (typeof(syncImportedPlaylist, autoAddSimilarSong) == "boolean") {
            Playlist.find({
                name: playlistName
            }, function(err, result) {
                if (err)
                    return callback(false, lang.playlist.unableToEditOptions);

                if (result[0].author_id != userId)
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
        Playlist.find({
            name: playlistName
        }, function(err, result) {
            if (err)
                return callback(false, lang.playlist.errorDeletingPlaylist);

            if (result[0].author_id != userId)
                return callback(false, lang.playlist.notOwner);

            if (result[0].musics.length == 0) {
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
                result[0].musics.forEach(function(music, index) {
                    r.push(function(cb) {
                        removeSong(playlistName, music, userId, function() {
                            cb();
                        });
                    });

                    if (index == result[0].musics.length - 1) {
                        r.push(function(cb) {
                            Playlist.remove({
                                name: playlistName
                            }, function(err) {
                                cb();
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

    function removeSong(playlistName, info, userId, callback) {
        Playlist.find({
            name: playlistName
        }, function(err, result) {
            if (err)
                return callback ? callback(false, lang.playlist.errorDeletingPlaylist) : null;

            if (result[0].author_id != userId)
                return callback ? callback(false, lang.playlist.notOwner) : null;

            Playlist.update({
                name: playlistName
            }, {
                $pull: {
                    musics: {
                        _id: info._id
                    }
                }
            }, {
                safe: true
            }, function(err) {
                if (err) {
                    return callback ? callback(false, lang.playlist.errorDeletingMusic) : null;
                }
                Playlist.findOne({
                    musics: {
                        $elemMatch: {
                            'infos.deezerId': info.infos.deezerId
                        }
                    }
                }, function(err, res) {
                    if (!res) {
                        fs.unlink(info.file, function() {
                            return callback ? callback(true, lang.playlist.successfullyDeletedMusic) : null;
                        })
                    } else
                        return callback ? callback(true, lang.playlist.successfullyDeletedMusic) : null;
                });
            });
        });
    }

    // Download

    function downloadSong(url, callback, progress) {
        alltomp3.getCompleteInfosFromURL(url).then(function(infos) {
            if (infos === undefined || (infos !== undefined && infos.deezerId === undefined)) {
                return q.push(function(cb) {
                    var dl = alltomp3.downloadAndTagSingleURL(url, './public/musics', function(infos) {
                        cb();
                        if (!infos)
                            return callback();

                        return callback(infos.file, infos.infos, url);
                    });

                    progress(dl);
                });
            }

            Playlist.findOne({
                musics: {
                    $elemMatch: {
                        'infos.deezerId': infos.deezerId
                    }
                }
            }, function(err, res) {
                if (res) {
                    for (var i = 0; i < res.musics.length; i++) {
                        if (res.musics[i].infos.deezerId && infos.deezerId && res.musics[i].infos.deezerId == infos.deezerId) {
                            return callback(res.musics[i].file, res.musics[i].infos, url);
                        }

                        if (res.musics[i].infos.spotifyId && infos.spotifyId && res.musics[i].infos.spotifyId == infos.spotifyId) {
                            return callback(res.musics[i].file, res.musics[i].infos, url);
                        }
                    }
                }

                q.push(function(cb) {
                    var dl = alltomp3.downloadAndTagSingleURL(url, './public/musics', function(infos) {
                        cb();
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
                else
                    socket.emit('wait', lang.playlist.downloads.replace('%d', (infos + 1)).replace('%d', Math.round(urls.items[infos].progress.download.progress)));
            });
            dl.on('download-end', function() {
                socket.emit('wait', lang.playlist.downloadEnd);
            });
            dl.on('convert', function(infos) {
                if (infos.progress)
                    socket.emit('wait', lang.playlist.convert.replace('%d', Math.round(infos.progress)));
                else
                    socket.emit('wait', lang.playlist.converts.replace('%d', (infos + 1)).replace('%d', Math.round(urls.items[infos].progress.convert.progress)));
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
            getAllPlaylists(function(pl) {
                socket.emit('allPlaylists', pl);
            });
        });

        socket.on('getMyPlaylists', function() {
            if (!socket.request.session.passport.user) {
                return socket.emit('fail', lang.playlist.sessionExpired);
            }

            getMyPlaylists(socket.request.session.passport.user, function(pl) {
                socket.emit('myPlaylists', pl);
            });
        });

        socket.on('getSongs', function(name) {
            getSongs(name, function(infos) {
                if (infos)
                    socket.emit('songs(' + name + ')', infos);
            });
        });

        socket.on('getPlaylistInfo', function(name) {
            getPlaylistInfo(name, function(syncImportedPlaylist, autoAddSimilarSong) {
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
                    addPlaylist(socket.request.session.passport.user, function(pl) {
                        socket.emit('myPlaylists', pl);
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

        socket.on('addSimilar', function(playlistName, index) {
            if (!socket.request.session.passport.user) {
                return socket.emit('fail', lang.playlist.sessionExpired);
            }

            if (index == null || index < 0) {
                return socket.emit('fail', lang.playlist.needToListenFirst);
            }

            addSimilar(playlistName, socket.request.session.passport.user, index, function(success, msg) {
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

        socket.on('removeSong', function(playlistName, info) {
            if (!socket.request.session.passport.user)
                return socket.emit('fail', lang.playlist.sessionExpired);

            removeSong(playlistName, info, socket.request.session.passport.user, function(success, msg) {
                if (success) {
                    socket.emit('success', msg);
                    getSongs(playlistName, function(infos) {
                        if (infos) {
                            socket.emit('songs(' + playlistName + ')', infos);
                            socket.broadcast.emit('songs(' + playlistName + ')', infos);
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
        getAllPlaylists(function(res) {
            res.forEach(function(playlist) {
                if (playlist.syncImportedPlaylist == true) {
                    playlist.importedPl.forEach(function(urlImportedPl) {
                        downloadSongs(urlImportedPl, function(file, infos, urlYt) {
                            if (!infos)
                                return;

                            for (var i = 0; i < playlist.musics.length; i++) {
                                if (playlist.musics[i].file == file)
                                    return;
                            }

                            Playlist.update({
                                name: playlist.name
                            }, {
                                $addToSet: {
                                    musics: {
                                        url: urlYt === undefined ? urlImportedPl : urlYt,
                                        file: file,
                                        infos: infos
                                    }
                                }
                            }, function(err) {
                                if (err)
                                    console.log(err);

                                return;
                            });
                        }, function(a) {

                        });
                    });
                }
            });
        });
    }, null, true, 'Europe/Paris');
};
