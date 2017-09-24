//load all the thing we need
var alltomp3 = require('alltomp3');

// load up the playlist model
var Playlist = require('../app/models/playlist');

var fs = require('fs');
var path = require('path');

// The zip library needs to be instantiated:
var nzip = require('node-zip');

module.exports = function(io, lang) {

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

    // Add

    function addSong(playlistName, url, userId, callback, progress) {
        downloadSong(url, function(file, infos) {
            if (!infos)
                return callback(false);

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
                    return callback(false);
                }

                return callback(true);
            });
        }, function(dl) {
            progress(dl);
        });
    }

    function addSongs(playlistName, url, userId, callback, progress) {
        downloadSongs(url, function(array) {
            if (!array)
                return callback(false);

            Playlist.update({
                name: playlistName
            }, {
                $addToSet: {
                    contributor_id: userId
                }
            }, function(err) {

            });

            for (var elem in array) {
                Playlist.update({
                    name: playlistName
                }, {
                    $addToSet: {
                        musics: {
                            url: url,
                            file: elem.file,
                            infos: elem.infos
                        }
                    }
                }, function(err) {
                    if (err) {
                        return callback(false);
                    }
                });
            }

            return callback(true);
        }, function(dl) {
            progress(dl);
        });
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
                            return callback(false);

                        newPlaylist.musics = [{
                            url: url,
                            file: file,
                            infos: infos
                        }];

                        newPlaylist.save(function(err) {
                            if (err) {
                                console.log(err);
                                return callback(false);
                            }

                            return callback(true);
                        });
                    }, function(dl) {
                        progress(dl);
                    });
                    break;

                case 'soundcloud playlist':
                case 'youtube playlist':
                case 'spotify playlist':
                case 'deezer playlist':
                    downloadSongs(url, function(arrays) {
                        if (!arrays)
                            return callback(false);

                        newPlaylist.musics = [];
                        for (var i = 0; i < arrays.length; i++) {
                            newPlaylist.musics.push({
                                url: url,
                                file: arrays[i].file,
                                infos: arrays[i].infos
                            });
                        }

                        newPlaylist.save(function(err) {
                            if (err) {
                                console.log(err);
                                return callback(false);
                            }

                            return callback(true);
                        });

                    }, function(dl) {
                        progress(dl);
                    });
                    break;
                default:
                    return callback(false);
            }

        } else {
            newPlaylist.save(function(err) {
                if (err) {
                    console.log(err);
                    return callback(false);
                }

                return callback(true);
            });
        }
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

            Playlist.remove({
                name: playlistName
            }, function(err) {
                if (err) {
                    console.log(err);
                    return callback(false, lang.playlist.errorDeletingPlaylist);
                }

                return callback(true);
            });
        });
    }

    function removeSong(playlistName, info, userId, callback) {
        Playlist.find({
            name: playlistName
        }, function(err, result) {
            if (err)
                return callback(false, lang.playlist.errorDeletingPlaylist);

            if (result[0].author_id != userId)
                return callback(false, lang.playlist.notOwner);

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
                    return callback(false, lang.playlist.errorDeletingMusic);
                }

                return callback(true);
            });
        });
    }

    // Download

    function downloadSong(url, callback, progress) {
        var dl = alltomp3.downloadAndTagSingleURL(url, './public/musics', function(infos) {
            if (!infos)
                return callback();

            return callback(infos.file, infos.infos);
        });

        progress(dl);
    }

    function downloadSongs(url, callback, progress) {
        var dl = alltomp3.downloadPlaylist(url, './public/musics', function(infos) {
            if (!infos)
                return callback();

            return callback(infos);
        }, 1, '/');

        progress(dl);
    }

    function downloadPlaylist(name, callback) {
        getSongs(name, function(res) {
            if (!res)
                callback(false);

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
            callback(true);
        });
    }
    // UI

    function progressMessages(dl, socket) {
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

        socket.on('downloadPlaylist', function(name) {
            socket.emit('wait', lang.playlist.waitUntilDownloadReady);
            downloadPlaylist(name, function(success) {
                socket.emit('wait', lang.playlist.waitUntilDownloadReady, true);
                if (success) {
                    socket.emit('success', lang.playlist.downloadReady);
                    socket.emit('downloadReady');
                } else
                    socket.emit('fail', lang.playlist.downloadFail);
            });
        });

        socket.on('addPlaylist', function(name, tag, url) {
            playlistCreationChecker(name, socket.request.session.passport.user, function(canCreate, msg) {
                if (!canCreate) {
                    return socket.emit('fail', msg);
                }

                addPlaylist(name, tag, url, socket.request.session.passport.user, function(success) {
                    if (!success)
                        return socket.emit('fail', lang.playlist.errorCreatingPlaylist);

                    getMyPlaylists(socket.request.session.passport.user, function(pl) {
                        socket.emit('myPlaylists', pl);
                    });
                    return socket.emit('success', lang.playlist.successfullyCreatedPlaylist);
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
                    addSong(playlistName, url, socket.request.session.passport.user, function(success) {
                        if (!success)
                            return socket.emit('fail', lang.playlist.errorAddingMusic);

                        getSongs(playlistName, function(infos) {
                            socket.emit('songs(' + playlistName + ')', infos);
                            socket.broadcast.emit('songs(' + playlistName + ')', infos);
                        });

                        return socket.emit('success', lang.playlist.successfullyAddedMusic);

                    }, function(dl) {
                        progressMessages(dl, socket);
                    });
                    break;
                case 'soundcloud playlist':
                case 'youtube playlist':
                case 'spotify playlist':
                case 'deezer playlist':
                    addSongs(playlistName, url, socket.request.session.passport.user, function(success) {
                        if (!success)
                            return socket.emit('fail', lang.playlist.errorImportingPlaylist);

                        getSongs(playlistName, function(infos) {
                            socket.emit('songs(' + playlistName + ')', infos);
                            socket.broadcast.emit('songs(' + playlistName + ')', infos);
                        });

                        return socket.emit('success', lang.playlist.successfullyImportedPlaylist);

                    }, function(dl) {
                        progressMessages(dl, socket);
                    });
                    break;
                default:
                    socket.emit('fail', lang.playlist.errorAddingMusic);
                    return;
            }
        });

        socket.on('removePlaylist', function(name, tag, url) {
            if (!socket.request.session.passport.user)
                return socket.emit('fail', lang.playlist.sessionExpired);

            removePlaylist(name, socket.request.session.passport.user, function(success, msg) {
                if (success)
                    socket.emit('success', lang.playlist.successfullyDeletedPlaylist);
                else
                    socket.emit('fail', msg);
            });
        });

        socket.on('removeSong', function(playlistName, info) {
            if (!socket.request.session.passport.user)
                return socket.emit('fail', lang.playlist.sessionExpired);

            removeSong(playlistName, info, socket.request.session.passport.user, function(success, msg) {
                if (success) {
                    socket.emit('success', lang.playlist.successfullyDeletedMusic);
                    getSongs(playlistName, function(infos) {
                        if (infos) {
                            socket.emit('songs(' + playlistName + ')', infos);
                            socket.broadcast.emit('songs(' + playlistName + ')', infos);
                        }
                    });
                } else
                    socket.emit('fail', msg);
            })
        });
    });
};
