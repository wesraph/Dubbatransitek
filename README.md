# Dubbatransitek

![Demo](https://image.noelshack.com/fichiers/2017/37/2/1505252055-dubbatransitek.gif)

Dubbatransitek is a collaborative musical platform. It allow you to import playlists from Youtube, Soundcloud, Spotify or Deezer. On the platform, you can create playlist, listen them, add, remove or download tracks, share to a friends, etc.

### Prerequisites

To run dubbatransitek, you need node and npm ([nvm](https://github.com/creationix/nvm) use is recommended). It is tested on npm 5.3.0 and node 8.4.0.
You'll also need python to run eyeD3.

 - ffmpeg >= 2.8 with lamemp3
 - eyeD3 >= 0.7.10
 - node-acoutstid requirements (https://github.com/parshap/node-acoustid#installation - https://acoustid.org/chromaprint)
 - mongodb

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
 - **0.0.1:** first working version

###TODO
 - permission
 - spotify and deezer track
 - advanced playlist research
 - playlist zip download
 - lang file
 - ...

### Tip
If you like my work, offer me a beer ! :)
- Paypal : https://paypal.me/guiisch
- ETH: 0xbE08c367280EF1b945c327419Afec474B5E1eff6
