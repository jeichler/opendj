(function(window) {
    window.__env = window.__env || {};


    window.__env.enableDebug = false;
    window.__env.curatorPassword = 'test';
    window.__env.playlistMaxSize = 100;
    window.__env.websocketHost = 'http://dev.opendj.io';
    window.__env.websocketPath = '/api/service-web/socket';

    window.__env.SPOTIFY_PROVIDER_API = 'http://dev.opendj.io/api/provider-spotify/v1';
    window.__env.PLAYLIST_PROVIDER_API = 'http://dev.opendj.io/api/service-playlist/v1';

}(this));