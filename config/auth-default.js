/*  |----------------------------------------------------------------|
 *  |                                                                |
 *  |               RENAME THIS FILE TO 'auth.js'                    |
 *  |                                                                |
 *  |----------------------------------------------------------------|
 */

// config/auth.js

// expose our config directly to our application using module.exports
module.exports = {

    /*'soundcloudAuth': {
        'clientID': '',
        'clientSecret': '',
        'callbackURL': 'http://XXX/auth/soundcloud/callback'
    },*/

    'spotifyAuth': {
        'clientID': 'XXX',
        'clientSecret': 'XXX',
        'callbackURL': 'http://XXX/auth/spotify/callback',
        'scope': ['user-read-private', 'user-read-email']
    },

    'youtubeAuth': {
        'clientID': 'XXX',
        'clientSecret': 'XXX',
        'callbackURL': 'http://XXX/auth/youtube/callback',
        'scope': ['https://www.googleapis.com/auth/youtube.readonly']
    },

    'deezerAuth': {
        'clientID': 'XXX',
        'clientSecret': 'XXX',
        'callbackURL': 'http://XXX/auth/deezer/callback',
        'scope': ['basic_access', 'email', 'offline_access', 'manage_library'],
        'passReqToCallback': true
    }

};
