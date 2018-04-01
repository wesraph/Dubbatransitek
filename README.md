# Dubbatransitek

![Demo](https://image.noelshack.com/fichiers/2017/37/2/1505252055-dubbatransitek.gif)

Dubbatransitek is a collaborative musical platform. It allow you to create or import playlists from Youtube, Soundcloud, Spotify or Deezer. On the platform, you can create playlist, listen them, add, remove or download tracks, share to a friends, etc.

### Prerequisites

To run dubbatransitek, you need node and npm ([nvm](https://github.com/creationix/nvm) use is recommended). It is tested on npm 5.3.0 and node 8.4.0.
You'll also need python to run eyeD3.

 - ffmpeg >= 2.8 with lamemp3, best way: remove ffmpeg and build it from source
```
apt-get remove ffmpeg    
apt-get update
apt-get install libx264-106 libx264-dev x264 subversion
su -
svn checkout svn://svn.ffmpeg.org/ffmpeg/trunk ffmpeg
cd ffmpeg
./configure --enable-gpl --enable-version3 --enable-nonfree --enable-postproc --enable-libfaac --enable-libmp3lame --enable-libopencore-amrnb --enable-libopencore-amrwb --enable-libtheora --enable-libvorbis --enable-libvpx --enable-libx264 --enable-libxvid --enable-x11grab
make
make install
```
 - eyeD3 >= 0.7.10 (https://eyed3.readthedocs.io/en/latest/installation.html)
```
apt-get install python
wget http://eyed3.nicfit.net/releases/eyeD3-0.8.1.tar.gz
tar xzf eyeD3-0.8.1.tar.gz
cd eyeD3-0.8.1
python setup.py install
```
 - node-acoutstid requirements (https://github.com/parshap/node-acoustid#installation - https://acoustid.org/chromaprint)
```
apt-get install libchromaprint-tools
```
 - mongodb (https://docs.mongodb.com/manual/installation/)

If you would like to use Youtube, Soundcloud, Spotify or Deezer authentification, you will also need to register a new app on website, and edit the auth-default.js file

 - [Youtube](https://developers.google.com/youtube/registering_an_application)
 - [Soundcloud](http://soundcloud.com/you/apps/new)
 - [Spotify](https://developer.spotify.com/my-applications/#!/applications/create)
 - [Deezer](http://developers.deezer.com/myapps/create)

### Installing

Simply run

```
npm install
```

### Run

Simply run

```
npm start
```

By default, it will use the environment variable PORT, or 8880 if there's nothing there.

### Versioning

 **0.0.5 (in-dev):**
 - Totaly rethink the database structure (add music model, be careful, old database <=0.0.4 or not compatible with newer)
 - Update README
 - Add docker ! Run dubbatransitek in a command ! (not finished)
 - Design change on playlist pages (sticky player)
 - Fix remove button (launch music when clicked)
 - Improve music changing speed: no more reloading

 **0.0.4:**
 - Remove the opacity fade transition (it was causing bug when seeking during the musics transition)
 - You can now add music directly with just a title
 - The song is no longer re-downloaded if it already was before
 - Delete playlist and song now delete file
 - You can also now add a music similar to the listened music of your playlist based from last.fm suggestion. In addition, you can now enable the option to automaticaly add similar songs when you finish listen your playlist (in order to not listen your playlist again)
 - fix next and previous button
 - fix pause when 2 songs are playing (when fade effect)
 - Update README
 - You have now the abality to enable automatic imported playlist syncing (if you import a youtube playlist for example, and add song on the same playlist on youtube several day later, dubbatransitek will automaticaly download the added song to add it to your Dubbatransitek playlist, run every day at midnight)
 - Add queue system: As transcoding video to mp3 use some CPU ressources, I created a queue. The queue is global for all user
 - Add volume bar (logarythm scale and mute at 1)

**0.0.3:**
 - switch from 'playlists' page to 'myPlaylists' and 'allPlaylists' pages (with a spotify style display on myPlaylists, allPlaylists design need to be redesign)
 - add 10s fade transition while playback music
 - fix remove song buttons
 - add download Playlist
 - add next and previous button
 - minor fix
 - add sync when adding or removing song from a playlist (if you add/remove a song on a playlist, the playlist will update automaticaly on every opened pages for all users, no need to refresh the page, can be usefull in party for example)

**0.0.2:**
 - Added permission (user not able to remove playlist or songs from another user playlists)
 - lang file is also added (./lang/fr_FR.json) feel free to translate ! :)

**0.0.1:**
 - first working version

### TODO
 - spotify and deezer track
 - Import playlist from youtube, deezer or spotify section
 - Improve download playlist function (add field on playlist model)
 - Page to edit music info
 - Playlist music ordering with something like https://github.com/RubaXa/Sortable
 - Fix souncloud playlist import
 - Random order playback
 - ...

### Tip
If you like my work, offer me a beer ! :)
- Paypal : https://paypal.me/guiisch
- ETH: 0xbE08c367280EF1b945c327419Afec474B5E1eff6
