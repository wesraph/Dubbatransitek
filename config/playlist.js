//load all the thing we need
var io = require('socket.io');

// load up the playlist model
var Playlist = require('../app/models/playlist');

module.exports = function(server) {
    io(server).on('connection', function(socket) {
        Playlist.find({}, {
            name: 1
        }, function(err, result) {
            if (err)
                return;

            var names = [];
            for (var i = 0; i < result.length; i++) {
                names.push(result[i].name);
            }

            socket.emit('getPlaylistsNames', names);
        });

        socket.on('add', function(name, tag, url) {
            var newPlaylist = new Playlist();
            newPlaylist.name = name;
            newPlaylist.tag = tag;
            newPlaylist.musics = [url];

            newPlaylist.save(function(err) {
                if (err)
                    return socket.emit('error');

                Playlist.find({}, {
                    name: 1
                }, function(err, result) {
                    if (err)
                        return;

                    var names = [];
                    for (var i = 0; i < result.length; i++) {
                        names.push(result[i].name);
                    }

                    socket.emit('getPlaylistsNames', names);
                });

                socket.emit('loaded', 'test');
                return socket.emit('success');
            });
        });
    });
};
