'use strict';

const readline = require('readline');
const fs = require('fs');
const compression = require('compression');
const express = require('express');
const app = express();
const router = new express.Router();
const cors = require('cors');
const request = require('request-promise');
const promiseRetry = require('promise-retry');
const log4js = require('log4js')
const log = log4js.getLogger();
log.level = process.env.LOG_LEVEL || "trace";

const PORT = process.env.PORT || 8081;
const COMPRESS_RESULT = process.env.COMPRESS_RESULT || "true";
const readyState = {
    datagridClient: false,
    refreshExpiredTokens: false,
    lastError: ""
};

const PLAYLIST_PROVIDER_URL = process.env.PLAYLIST_PROVIDER_URL || "http://localhost:8082/api/service-playlist/v1/";



// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// ------------------------------ datagrid stuff -----------------------------
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
const DATAGRID_URL = process.env.DATAGRID_URL || "localhost:11222"
const datagrid = require('infinispan');
var cacheTracks = null;
var cacheState = null;

async function connectToCache(name) {
    let cache = null;
    try {
        log.debug("begin connectToCache %s", name);
        let splitter = DATAGRID_URL.split(":");
        let host = splitter[0];
        let port = splitter[1];
        cache = await datagrid.client([{ host: host, port: port }], { cacheName: name, mediaType: 'application/json' });
        readyState.datagridClient = true;
        log.debug("connected to grid %s", name);
    } catch (err) {
        readyState.datagridClient = false;
        readyState.lastError = err;
        throw "DataGrid connection FAILED with err " + err;
    }

    return cache;
}

function disconnectFromCache(cache) {
    if (cache) {
        try {
            cache.disconnect();
        } catch (err) {
            log.debug("disconnectFromCache - err ignored", err);
        }
    }
}

async function checkGridConnection() {
    log.trace("begin checkGridConnection");
    let result = false;
    for (let i = 0; i < 3; i++) {

        try {
            await cacheTracks.get("-1");
            readyState.datagridClient = true;
            readyState.lastError = "";
            result = true;
        } catch (err) {
            readyState.datagridClient = false;
            readyState.lastError = err;
            log.error("checkGridConnection failed - try to reconnect", err);
            try {
                await connectAllCaches();
            } catch (reconnectError) {
                log.debug("checkGridConnection: re-connect error ignored", reconnectError);
            }
        }
    }

    log.trace("end checkGridConnection result=", result);
    return result;
}

async function connectAllCaches() {
    log.trace("begin connectAllCaches");
    disconnectFromCache(cacheTracks);
    disconnectFromCache(cacheState);
    cacheTracks = await connectToCache("TRACKS");
    cacheState = await connectToCache("PROVIDER_SPOTIFY_STATE");
    log.info("CACHES CONNECTED");
    log.trace("end connectAllCaches");
}

async function getFromCache(cache, key) {
    try {
        let val = await cache.get(key);
        if (val)
            val = JSON.parse(val);
        return val;
    } catch (err) {
        handleCacheError(cache, err);
        throw err;
    }
}

async function putIntoCache(cache, key, value) {
    log.trace("begin putIntoCache");
    await cache.put(key, JSON.stringify(value));
    log.trace("end putIntoCache");
}

function putIntoCacheAsync(cache, key, value) {
    log.trace("begin putIntoCacheAsync cache=%s, key=%s, value=%s", cache, key, value);
    cache.put(key, JSON.stringify(value))
        .then(function() {
            log.trace("putIntoCacheAsync success");
        })
        .catch(function(err) {
            log.warn("putIntoCacheAsync failed - ignoring error %s", err);
            handleCacheError(cache, err);
        });
    log.trace("end putIntoCache");
}

function fireEventStateChange(event) {
    log.trace("begin fireEventStateChange");
    putIntoCacheAsync(cacheState, event.eventID, event);
    log.trace("end fireEventStateChange");
}

function handleCacheError(cache, err) {
    log.error("Cache error: %s", err);
    log.error("cache=%s", JSON.stringify(cache));
    readyState.datagridClient = false;
    readyState.lastError = err;
    handleFatalError();
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// ------------------- spotify authentication stuff -------------------------
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
const SpotifyWebApi = require('spotify-web-api-node');
const spotifyClientID = process.env.SPOTIFY_CLIENT_ID || "-unknown-";
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET || "-unknown-";
const spotifyRedirectUri = process.env.SPOTIFY_CALLBACK_URL || "-unknown-";
const spotifyScopes = ['user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing', 'playlist-modify-private', 'user-read-email', 'playlist-read-private', 'playlist-read-collaborative'];

// Interval we check for expired tokens:
const SPOTIFY_REFRESH_TOKEN_INTERVAL = process.env.SPOTIFY_REFRESH_TOKEN_INTERVAL || "60000";


// Offset we refresh a token BEFORE it expires - to be sure, we do this 5 minutes BEFORE
// it expires:
const SPOTIFY_REFRESH_TOKEN_OFFSET = process.env.SPOTIFY_REFRESH_TOKEN_OFFSET || "300000";

// To avoid that several pods refresh at the same time, we add some random
// value (up to 3 min) to the offset:
const SPOTIFY_REFRESH_TOKEN_OFFSET_RANDOM = process.env.SPOTIFY_REFRESH_TOKEN_OFFSET_RANDOM || "180000";

// Number of genres to return for track details:
const SPOTIFY_TRACK_DETAIL_NUM_GENRES = process.env.SPOTIFY_TRACK_DETAIL_NUM_GENRES || "2";
const SPOTIFY_TRACK_DETAIL_NUM_ARTISTS = process.env.SPOTIFY_TRACK_DETAIL_NUM_ARTISTS || "2";

const SPOTIFY_SEARCH_LIMIT = process.env.SPOTIFY_SEARCH_LIMIT || "20";

const SPOTIFY_AUTOSELECT_DEVICE = (process.env.SPOTIFY_AUTOSELECT_DEVICE || 'true') == 'true';
const SPOTIFY_RETRIES = process.env.SPOTIFY_RETRIES || "1";;
const SPOTIFY_RETRY_TIMEOUT_MIN = process.env.SPOTIFY_RETRY_TIMEOUT_MIN || "1000";
const SPOTIFY_RETRY_TIMEOUT_MAX = process.env.SPOTIFY_RETRY_TIMEOUT_MAX || "1000";


// Map of Spotify API Objects:
// Key: EventID
// Value: SpotifyWebApi Object
var mapOfSpotifyApis = {
    "42": null
}

// Example Object for an Event State - this is clone for all events:
const eventStatePrototype = {
    eventID: "-1", // ID of Music Event  
    access_token: "",
    refresh_token: "",
    client_state: "",
    token_expires: "",
    token_created: "",
    token_refresh_failures: 0,
    isPlaying: false,
    currentTrack: "",
    currentDevice: "",
    timestamp: new Date().toISOString(),
};

// The Map of Event States:
// Key: EventID
// Value: EventState Object 

// var mapOfEventStates = new Map();


function getSpotifyApiForEvent(event) {
    log.trace("begin getSpotifyApiForEvent event=%s, eventID=%s", event, event.eventID);
    let spotifyApi = mapOfSpotifyApis[event.eventID];
    let eventID = event.eventID;

    if (spotifyApi == null) {
        log.debug("Create SpotifyApi for eventID=%s...", eventID);
        log.debug("clientId=>%s<, clientSecret=>%s<, redirectUri=>%s<", spotifyClientID, spotifyClientSecret, spotifyRedirectUri);
        spotifyApi = new SpotifyWebApi({
            clientId: spotifyClientID,
            clientSecret: spotifyClientSecret,
            redirectUri: spotifyRedirectUri
        });
        mapOfSpotifyApis[eventID] = spotifyApi;
        log.debug("Create SpotifyApi for eventID=%s...DONE", eventID);
    } else {
        log.trace("spotifyApiForEvent already present");

    }
    // Make sure Api has latest Tokens:
    if (event.access_token != null && spotifyApi.getAccessToken() != event.access_token) {
        log.debug("Update API access token from state");
        spotifyApi.setAccessToken(event.access_token);
    }
    if (event.refresh_token != null && spotifyApi.getRefreshToken() != event.refresh_token) {
        log.debug("Update API refresh token from state");
        spotifyApi.setRefreshToken(event.refresh_token);
    }

    // TODO: Check if Access token did expire
    log.trace("end getSpotifyApiForEvent eventID=%s", event.eventID);
    return spotifyApi;
}

async function getEventStateForEvent(eventID) {
    log.trace("begin getEventStateForEvent id=%s", eventID);
    let eventState = await getFromCache(cacheState, eventID);
    if (eventState == null) {
        log.debug("EvenState object created for eventID=%s", eventID);
        eventState = Object.assign({}, eventStatePrototype);
        eventState.eventID = eventID;
        eventState.timestamp = new Date().toISOString();
    } else {
        log.debug("event from cache = %s", JSON.stringify(eventState));
    }
    log.trace("end getEventStateForEvent id=%s", eventID);
    return eventState;
}

function updateEventTokensFromSpotifyBody(eventState, body) {
    let now = new Date();
    log.debug("updateEventTokensFromSpotifyBody body=%s", JSON.stringify(body));
    if (body['access_token']) {
        log.trace("received new access token");
        eventState.access_token = body['access_token'];
    } else {
        log.error("THIS SHOULD NOT HAPPEN: received no new access token upon refresh, eventState=%s body=%s", JSON.stringify(eventState), JSON.stringify(body));
    }

    if (body['refresh_token']) {
        log.info("received new refresh token");
        eventState.refresh_token = body['refresh_token'];
    }

    eventState.token_created = now.toISOString();
    eventState.token_expires = new Date(now.getTime() + 1000 * body['expires_in']).toISOString();
}

// We are using "Authorization Code Flow" as we need full access on behalf of the user.
// Read https://developer.spotify.com/documentation/general/guides/authorization-guide/ to 
// understand this, esp. the references to the the steps.
// step1: - generate the login URL / redirect....
router.get('/events/:eventID/providers/spotify/login', async function(req, res) {
        log.debug("getSpotifyLoginURL");
        let eventID = req.params.eventID;
        let event = await getEventStateForEvent(eventID);
        let spotifyApi = getSpotifyApiForEvent(event);
        let authorizeURL = spotifyApi.createAuthorizeURL(spotifyScopes, eventID);
        log.debug("authorizeURL=%s", authorizeURL);

        // Unless we have an event regisgration page, we
        // redirect for convience:
        res.redirect(authorizeURL);

        // If we go for the real thing, we need to send the URL:
    } //   res.send(authorizeURL);
);

// This is Step 2 of the Authorization Code Flow: 
// Redirected from Spotify AccountsService after user Consent.
// We receive a code and need to trade that token into tokens:
router.get('/auth_callback', async function(req, res) {
    log.trace("auth_callback start req=%s", JSON.stringify(req.query));
    let code = req.query.code;
    let state = req.query.state;
    let eventID = state;
    log.debug("code = %s, state=%s", code, state);

    try {
        // Trade CODE into TOKENS:
        let eventState = await getEventStateForEvent(eventID);
        let spotifyApi = getSpotifyApiForEvent(eventState);
        log.debug("authorizationCodeGrant with code=%s", code);
        let data = await spotifyApi.authorizationCodeGrant(code);

        log.debug("authorization code granted for eventID=%s!", eventID);

        // Set tokens on the Event Object to use it in later spotify API calls:                
        updateEventTokensFromSpotifyBody(eventState, data.body);
        fireEventStateChange(eventState);

        // Make sure we have the new tokens at the API set:
        spotifyApi = getSpotifyApiForEvent(eventState);

        log.debug("Get information about user from spotify");
        let spotifyUser = await spotifyApi.getMe();
        spotifyUser = spotifyUser.body;
        log.debug("spotifyUser", spotifyUser);
        let provider = {
            type: 'spotify',
            id: spotifyUser.id,
            display: spotifyUser.display_name,
            email: spotifyUser.email,
        }

        if (spotifyUser.images && spotifyUser.images[0] && spotifyUser.images[0].url) {
            provider.image_url = spotifyUser.images[0].url;
        } else {
            provider.image_url = 'assets/img/user_unknown.png';
        }

        log.debug("Register new provider with event");
        provider = await request({
            method: 'POST',
            uri: PLAYLIST_PROVIDER_URL + 'events/' + eventID + '/providers',
            body: provider,
            json: true,
            timeout: 1000
        });
        log.debug("Register new provider with event success!", provider);


        // Which Page to continue with after succesfull spotify login?

        // To the event login page:
        // let continueWith = "/" + eventID;

        // To the create/edit event page:
        let continueWith = "/ui/event-edit";

        // To the curator page:
        // let continueWith = "/ui/playlist-curator";

        // Let's try to start bohemian rhapsody:
        autoSelectDevice(spotifyApi, eventState)
            .then(function() {
                spotifyApi.play({ uris: ["spotify:track:4u7EnebtmKWzUH433cf5Qv"] });
            }).then(function() {
                res.send("<html><head><meta http-equiv=\"refresh\" content=\"10;url=" + continueWith + "\"/></head><body>Spotify Authorization was successful, Spotify App should be playing Bohemian Rhapsody for the next 10 seconds.</body></html>");
                setTimeout(function() {
                    spotifyApi.pause({ device_id: eventState.currentDevice });
                }, 10000);
            }).catch(function(err) {
                res.send("Spotify Authorization was successful, but test playback failed.<br>Make sure Spotify App is active on the desired device by start/stopping a track using spotify on that device!<br/>Error from Spotify was:" + JSON.stringify(err) + "<br><a href=\"" + continueWith + "\">Press here to continue!</a><br>");
            });
    } catch (err) {
        log.error("authorizationCodeGrant processing failed for event %s with err", eventID, err);
        handleError(err, res);
    }


});

// Step 3 is using the access_token - omitted here for obvious reasons.

// Step 4 of the flow - refresh tokens!
function refreshAccessToken(event) {
    log.trace("refreshAccessToken begin eventID=%s", event.eventID);

    if (!event.token_expires) {
        log.debug("refreshAccessToken: event has no token_expires, nothing to do here");
        return;
    }

    let expTs = Date.parse(event.token_expires);
    let expTsOrig = expTs;
    let now = Date.now();

    // Access token is valid typically for 1hour (3600seconds)
    // We refresh it a bit before it expieres, to ensure smooth transition:
    expTs = expTs - SPOTIFY_REFRESH_TOKEN_OFFSET;

    // To avoid that several pods refresh at the same time, we add some random
    // value to the offset:
    expTs = expTs - Math.floor(Math.random() * SPOTIFY_REFRESH_TOKEN_OFFSET_RANDOM);

    if (log.isDebugEnabled()) {
        log.debug("refreshAccessToken: expTsOrig=%s", new Date(expTsOrig).toISOString());
        log.debug("refreshAccessToken: expTs    =%s", new Date(expTs).toISOString());
        log.debug("refreshAccessToken: now      =%s", new Date(now).toISOString());
    }

    if (expTs < now) {
        log.debug("refreshAccessToken: access token for eventID=%s is about to expire in %s sec - initiating refresh... ", event.eventID, (expTsOrig - now) / 1000);

        let api = getSpotifyApiForEvent(event);
        api.refreshAccessToken().then(
            function(data) {
                log.info("access token for eventID=%s is expired - initiating refresh...SUCCESS", event.eventID);
                updateEventTokensFromSpotifyBody(event, data.body);
                fireEventStateChange(event);
            },
            function(err) {
                event.token_refresh_failures++;
                // TODO: Act if to many refresh_failures occur!
                log.error('Could not refresh access token', err);
            }
        );
    } else {
        log.debug("refreshAccessToken: token for eventID=%s  is still valid", event.eventID);
    }
    log.trace("refreshAccessToken end eventID=%s", event.eventID);
}

async function refreshExpiredTokens() {
    log.trace("refreshExpiredTokens begin");
    try {
        let it = await cacheState.iterator(10);
        let entry = await it.next();

        while (!entry.done) {
            log.trace("entry = %s", JSON.stringify(entry));
            refreshAccessToken(JSON.parse(entry.value));
            entry = await it.next();
        }

        await it.close();

        readyState.refreshExpiredTokens = true;
    } catch (err) {
        readyState.refreshExpiredTokens = false;
        log.fatal("!!! refreshExpiredTokens failed with err %s", err)
        handleFatalError();
    }

    log.trace("refreshExpiredTokens end");
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// ----------------------- spotify track logic ------------------------------
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------

const mapOfSimpleGenres = new Map();
const mapOfGenreCoordinates = new Map(); // Key: String Genre Name, Value: {x, y, w}

async function loadSimplifiedGenresFromFile() {
    log.trace("begin loadSimplifiedGenresFromFile");
    let rl = readline.createInterface({
        input: fs.createReadStream('genresSimplified.txt')
    });

    let line_no = 0;
    rl.on('line', function(line) {
        line_no++;
        mapOfSimpleGenres.set(line, line_no);
    });
    rl.on('close', function(line) {
        log.info('Loaded %s simple genres', line_no);
    });
}

function loadGenreMapFromFile() {
    const genreMap = require("./genreMap/genreMap.json");
    // Genre Map provides absolute coordinates for each genre.
    // We want to provide normalized coordinates ranging from 0.0 -> 1.0
    // Thus we iterate of of genres
    for (let genre in genreMap.genres) {
        const genreDataAbs = genreMap.genres[genre];
        const genreDataNorm = {
            x: genreDataAbs.x / genreMap.width,
            y: genreDataAbs.y / genreMap.height,
            w: genreDataAbs.w / 100.0
        }
        mapOfGenreCoordinates.set(genre, genreDataNorm);
    }
    log.info('Loaded genre map with %s genres', mapOfGenreCoordinates.size);
}

function getFirstGenreFromComplexGenreString(complexGenreString) {
    return complexGenreString.split(",")[0];

}
// Reduces a genre string like
// "album rock, blues-rock, classic rock, hard rock, psychedelic rock, rock"
// to simple "rock"
function simplifyGenre(complexGenreString) {
    log.trace("begin simplifyGenre");

    let simpleGenre = null;

    if (complexGenreString) {
        // in 90% of all cases, we have something like "album rock", "hard rock"
        // So we take the first genre, take the last word and check if this is in our map
        // of simple genres. In the example, this would be "rock":
        let genres = complexGenreString.split(", ");
        for (let i = 0; i < genres.length && !simpleGenre; i++) {
            let genre = genres[i];
            let words = genre.split(' ');
            let lastWord = words[words.length - 1];
            if (mapOfSimpleGenres.has(lastWord)) {
                simpleGenre = lastWord;
            } else {
                // Hm, the last word only did not work. Maybe we look at something like "hip hop", so
                // let's try the last two words:
                if (words.length >= 2) {
                    let lastTwoWords = words[words.length - 2] + ' ' + words[words.length - 1];
                    if (mapOfSimpleGenres.has(lastTwoWords)) {
                        simpleGenre = lastTwoWords;
                    }
                }
            }

            if (!simpleGenre) {
                // Maybe I am thinking to complex and things are very very easy:
                if (mapOfSimpleGenres.has(genre)) {
                    simpleGenre = genre;
                }
            }
        }

        if (!simpleGenre) {
            log.warn("Could not simplify genre %s", complexGenreString);
        }
    }


    if (!simpleGenre) {
        // Last Resort - we simply dont know:
        simpleGenre = "unknown";
    }

    log.trace("end simplifyGenre");
    return simpleGenre;
}

function mapSpotifyTrackToOpenDJTrack(sptTrack) {
    let odjTrack = {};
    odjTrack.id = sptTrack.id;
    odjTrack.name = sptTrack.name;

    odjTrack.artist = "";
    for (let i = 0; i < sptTrack.artists.length; i++) {
        if (i > SPOTIFY_TRACK_DETAIL_NUM_ARTISTS) break;
        if (i > 0) odjTrack.artist += ", ";
        odjTrack.artist += sptTrack.artists[i].name;
    }

    if (sptTrack.album.release_date) {
        odjTrack.year = parseInt(sptTrack.album.release_date.substring(0, 4));
    } else {
        odjTrack.year = 4242;
    }


    // Use the album images. Spotify returns widest first, we want the smallest, thus
    // we return the last:
    if (sptTrack.album.images.length > 0) {
        odjTrack.image_url = sptTrack.album.images[sptTrack.album.images.length - 1].url;
        odjTrack.image_url_ref = sptTrack.album.external_urls.spotify;
    } else {
        // TODO: Return URL to OpenDJ Logo
        odjTrack.image_url = "";
    }

    odjTrack.duration_ms = sptTrack.duration_ms;
    odjTrack.preview = sptTrack.preview_url;
    odjTrack.previewViaApp = sptTrack.external_urls.spotify;
    odjTrack.popularity = sptTrack.popularity;
    odjTrack.provider = "spotify";

    return odjTrack;
}


function mapSpotifySearchResultToOpenDJSearchResult(spotifyResult) {
    let result = [];
    for (let sptTrack of spotifyResult.tracks.items) {
        result.push(mapSpotifyTrackToOpenDJTrack(sptTrack));
    }

    return result;
}

function timesCharExistInString(str, chr) {
    let total = 0,
        last_location = 0,
        single_char = (chr + '')[0];
    while (last_location = str.indexOf(single_char, last_location) + 1) {
        total = total + 1;
    }
    return total;
};

function collapseArrayIntoSingleString(currentString, arrayOfStrings, maxEntries) {
    log.trace("begin collapseArrayIntoSingleString current=%s, array=%s, max=%i", currentString, arrayOfStrings, maxEntries);
    let result = currentString;

    if (arrayOfStrings && arrayOfStrings.length > 0) {
        let numEntries = timesCharExistInString(result, ',');
        if (numEntries == 0 && currentString.length > 0) numEntries = 1;

        for (let i = 0; i < arrayOfStrings.length; i++) {
            if (numEntries >= maxEntries) break;
            if (result.length > 0) result += ", ";
            log.trace("adding %s", arrayOfStrings[i]);
            result += arrayOfStrings[i];
            numEntries++;
        }
    }
    log.trace("end collapseArrayIntoSingleString result=%s", result);
    return result;
}

function mapSpotifyTrackResultsToOpenDJTrack(trackResult, albumResult, artistResult, audioFeaturesResult) {
    log.trace("begin mapSpotifyTrackResultsToOpenDJTrack");
    let result = {};
    if (trackResult && trackResult.body) {
        result = mapSpotifyTrackToOpenDJTrack(trackResult.body);
    }

    // ---- Genre ----
    result.genre = "";
    if (albumResult && albumResult.body) {
        log.trace("adding  genres >%s< from album", albumResult.body.genres);
        result.genre = collapseArrayIntoSingleString(result.genre, albumResult.body.genres, SPOTIFY_TRACK_DETAIL_NUM_GENRES);
        log.trace("genre after album.genres=%s", result.genre);
    }

    if (artistResult && artistResult.body) {
        log.trace("adding  genres >%s< from artist", artistResult.body.genres);
        result.genre = collapseArrayIntoSingleString(result.genre, artistResult.body.genres, SPOTIFY_TRACK_DETAIL_NUM_GENRES);
        log.trace("genre after artist.genres=%s", result.genre);
    }
    result.genreSimple = simplifyGenre(result.genre);
    result.genreSimpleNum = mapOfSimpleGenres.get(result.genreSimple);

    // ----- Genre-Map -----
    const firstGenre = getFirstGenreFromComplexGenreString(result.genre);
    log.trace("genreMap: first=>%s<", firstGenre);
    result.genreMap = mapOfGenreCoordinates.get(firstGenre);
    if (!result.genreMap) {
        result.genreMap = {
            x: 0.5,
            y: 0.5,
            w: 0.0
        };
    }

    // ----- Track Meta Data -----
    if (audioFeaturesResult && audioFeaturesResult.body) {
        result.danceability = Math.round(audioFeaturesResult.body.danceability * 100);
        result.energy = Math.round(audioFeaturesResult.body.energy * 100);
        result.acousticness = Math.round(audioFeaturesResult.body.acousticness * 100);
        result.instrumentalness = Math.round(audioFeaturesResult.body.instrumentalness * 100);
        result.liveness = Math.round(audioFeaturesResult.body.liveness * 100);
        result.happiness = Math.round(audioFeaturesResult.body.valence * 100);
        result.bpm = Math.round(audioFeaturesResult.body.tempo);
    } else {
        result.danceability = -1;
        result.energy = -1;
        result.acousticness = -1;
        result.instrumentalness = -1;
        result.liveness = -1;
        result.happiness = -1;
        result.bpm = -1;
    }

    log.trace("end mapSpotifyTrackResultsToOpenDJTrack");
    return result;
}

function mapSpotifyPlaylistToOpenDJPlaylist(playlist) {
    return {
        id: playlist.id,
        name: playlist.name,
        numTracks: playlist.tracks.total,
        desc: playlist.description
    };
}

async function getTrackDetails(event, trackID) {
    log.trace("begin getTrackDetails eventID=%s, trackID=%s", event.eventID, trackID);

    let trackResult = null;
    let audioFeaturesResult = null;
    let albumResult = null;
    let artistResult = null;
    let result = null;
    let api = getSpotifyApiForEvent(event);

    // If TrackID contains a "spotify:track:" prefix, we need to remove it:
    let colonPos = trackID.lastIndexOf(":");
    if (colonPos != -1) {
        trackID = trackID.substring(colonPos + 1);
    }

    // CACHING, as the following is quite Expensive, and we would like
    // to avoid to run into Spotify API rate limits:
    try {
        result = await getFromCache(cacheTracks, "spotify:" + trackID);
    } catch (cacheFailed) {
        log.warn("DataGrid GET TRACKS failed - ignoring error %s", cacheFailed);
    }

    if (result && result.genreMap) {
        log.debug("trackDetails cache hit");
    } else {
        log.debug("trackDetails cache miss");

        // We have to make four calls - we do that in parallel to speed things up
        // The problem is the "Genre" Result - it's not stored with the track, but with
        // either the album or the artist. So here we go:
        // #1: Get basic Track Result:
        log.trace("getTrack()");
        trackResult = api.getTrack(trackID);

        // #2: Get get Track Audio Features (danceability, energy and stuff):
        log.trace("getAudioFeaturesForTrack()");
        audioFeaturesResult = api.getAudioFeaturesForTrack(trackID);

        // When we have trackResult we get the album and artist ID , and with that, we can make call 
        // #3 to get album details and ...
        try {
            log.trace("awaiting trackResult");
            trackResult = await trackResult;
        } catch (err) {
            log.info("getTrack() failed with error:" + err);

            // Need to handle audioFeaturesResult which might respond later to avoid "unhandeled promise rejection warnings" - we can ignore that one.
            audioFeaturesResult.catch(function(err2) {
                log.debug("ignoring concurrent GetaudioFeatureResult error while handling getTrack() err=%s" + err2);
            });

            // Rethrow original error:
            throw err;
        }

        if (trackResult && trackResult.body && trackResult.body.album && trackResult.body.album.id) {
            log.trace("getAlbum()");
            albumResult = api.getAlbum(trackResult.body.album.id);
        }

        // ... call #4 to get Artist Result:
        if (trackResult && trackResult.body && trackResult.body.artists && trackResult.body.artists.length > 0) {
            log.trace("getArtist()");
            artistResult = api.getArtist(trackResult.body.artists[0].id);
        }

        // Wait for all results to return:
        // Error Handling is a bit ugly, but needs to be done to avoid "Unhandled promise rejections" messages,
        // which could kill the process in the future of nodejs.
        try {
            log.trace("await albumResult")
            albumResult = await albumResult;
        } catch (err) {
            log.info("error while await album for ignoring err=" + err);
        }

        try {
            log.trace("await audioFeaturesResult");
            audioFeaturesResult = await audioFeaturesResult;
        } catch (err) {
            log.info("error while await audio features for track- ignoring err=" + err);
        }

        try {
            log.trace("await artistResult");
            artistResult = await artistResult;
        } catch (err) {
            log.info("error while await audio artist  for track %s - ignoring err=" + err, trackID);
        }

        /* FOR DEBUGGING:
            result = {
                track: trackResult,
                album: albumResult,
                artist: artistResult,
                audioFeaturesResult: audioFeaturesResult,
                result: result,
            });
         */
        result = mapSpotifyTrackResultsToOpenDJTrack(trackResult, albumResult, artistResult, audioFeaturesResult);

        // Cache result:
        putIntoCacheAsync(cacheTracks, "spotify:" + trackID, result);
    }

    log.trace("end getTrackDetails");
    return result;
}


async function pause(eventID) {
    log.trace("begin pause ");

    let event = await getEventStateForEvent(eventID);
    let api = getSpotifyApiForEvent(event);

    await api.pause({ device_id: event.currentDevice });
    log.info("PAUSE eventID=%s", eventID);

    log.trace("end pause");
}



async function play(eventID, trackID, pos) {
    log.trace("begin play");

    log.debug("play eventID=%s, trackID=%s, pos=%s", eventID, trackID, pos);
    let event = await getEventStateForEvent(eventID);
    let api = getSpotifyApiForEvent(event);



    // If TrackID contains a "spotify:track:" prefix, we need to remove it:
    let colonPos = trackID.lastIndexOf(":");
    if (colonPos != -1) {
        trackID = trackID.substring(colonPos + 1);
    }
    let uris = ["spotify:track:" + trackID];
    let options = { uris: uris };

    if (event.currentDevice) {
        log.debug("event has currentDevice set - using it");
        options.device_id = event.currentDevice;
    }

    if (pos) {
        options.position_ms = pos;
    }

    log.trace("play options: ", JSON.stringify(options));
    //    await api.play(options);

    // play sometimes fails on first try, probably due to comm issues
    // with the device. Thus we re-try 
    // before getting into fancy error handling:
    try {
        await promiseRetry(function(retry, number) {
            log.debug("call spotify play, try #", number);
            return api.play(options).catch(retry);
        }, { retries: SPOTIFY_RETRIES, minTimeout: SPOTIFY_RETRY_TIMEOUT_MIN, maxTimeout: SPOTIFY_RETRY_TIMEOUT_MAX });

        log.debug("play was successful");

    } catch (err) {
        log.debug("play failed with err=%s - will try to handle this", err);
        try {
            // res.status(200).send({ code: "SPTFY-200", msg: "needed to handle spotify error, maybe device was changed!" });
            await handlePlayError(err, options, event, api);
            log.debug("play was successful after handling initial error");
        } catch (err2) {
            log.debug("play failed after handling initial error with new error=%s", err2);
            throw {
                code: "SPTFY-500",
                msg: "play failed despite retries! Initial Error=" + err + " Second Error=" + err2
            };
        }
        log.trace("end first catch");
    }



    // Todo: verify via currentTrack that player is actually playing!

    log.trace("end play");
}


async function handlePlayError(err, options, event, api) {
    log.debug("Play failed despite retry. err=" + err);
    if (SPOTIFY_AUTOSELECT_DEVICE && ("" + err).includes("Not Found")) {
        log.debug("expected shit happend - device not found - try autoselect a device");
        let deviceChanged = await autoSelectDevice(api, event);
        if (deviceChanged) {
            log.debug("AutoSelect did change device setting, so play it again, same!");
            options.device_id = event.currentDevice;
            await promiseRetry(function(retry, number) {
                log.debug("call spotify play, try #", number);
                return api.play(options).catch(retry);
            }, { retries: SPOTIFY_RETRIES, minTimeout: SPOTIFY_RETRY_TIMEOUT_MIN, maxTimeout: SPOTIFY_RETRY_TIMEOUT_MAX });
        } else {
            log.error("handlePlayError: autoSelectDevice did not change device setting, escalating initial problem");
            throw err;
        }
    } else {
        log.debug("unexpected shit happend, or autoplay is disabled - we can do nothing here");
        throw err;
    }
}


async function autoSelectDevice(api, event) {
    log.trace("begin autoSelectDevice");

    log.debug("Asking spotify about available devices");
    let data = await api.getMyDevices()
    log.debug("Response from spotify getMyDevices: " + JSON.stringify(data.body));
    let devices = data.body.devices;
    let result = false;
    if (devices.length == 0) {
        log.debug("device list is empty");
        throw { code: "SPTFY-100", msg: "No devices available - Please start spotify on the desired playback device" };
    }
    // Per default, we take the first device. If there is an active
    // one, we prefer that:
    let deviceId = devices[0].id;
    for (let device of devices) {
        if (device.is_active) {
            log.debug("selecting active device ", device.id);
            deviceId = device.id;
            break;
        }
    }
    if (deviceId != event.currentDevice) {
        log.info("AUTOSELECT device %s for event %s", deviceId, event.eventID);
        event.currentDevice = deviceId;
        fireEventStateChange(event);
        result = true;
    } else {
        log.info("AUTOSELECT: no (new) device found");
        result = false;
    }
    log.trace("end autoSelectDevice result=", result);
    return result;
}




// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// --------------------------- sync api routes ------------------------------
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
if (COMPRESS_RESULT == 'true') {
    log.info("compression enabled");
    app.use(compression())
} else {
    log.info("compression disabled");

}

app.use(cors());
app.use(express.json());


function handleFatalError() {
    process.exit(44);
}

function handleError(err, response) {
    log.error('Error: ' + err);
    if (err.code && err.msg) {
        response.status(500).send(err);
    } else {
        response.status(500).send({
            "msg": "Call to Spotify failed?! Did the event owner provide credentials? Is the playback device active? Spotify says:" + err,
            "code": "SPTY-542"
        });

    }
}

router.get('/events/:eventID/providers/spotify/currentTrack', async function(req, res) {
    log.debug("getCurrentTrack");

    let eventID = req.params.eventID;
    let event = await getEventStateForEvent(eventID);
    let api = getSpotifyApiForEvent(event);

    api.getMyCurrentPlaybackState({}).then(function(data) {
        log.debug("Now Playing: ", data.body);
        res.send(data.body);
    }, function(err) {
        handleError(err, res);
    });
});


async function getAvailableDevices(event, api) {
    let data = await api.getMyDevices();

    let result = {
        availableDevices: [],
        currentDevice: event.currentDevice
    };

    data.body.devices.forEach(device => {
        result.availableDevices.push({
            id: device.id,
            desc: device.type + " " + device.name + (device.is_active ? " - active" : " - passive"),
        });
    });

    return result;
}

router.get('/events/:eventID/providers/spotify/devices', async function(req, res) {
    log.trace("getAvailableDevices begin");

    try {
        let eventID = req.params.eventID;
        let event = await getEventStateForEvent(eventID);
        let api = getSpotifyApiForEvent(event);
        let result = await getAvailableDevices(event, api);
        res.send(result);
    } catch (error) {
        handleError(error, res);
    }

    log.trace("getAvailableDevices end");
});

router.post('/events/:eventID/providers/spotify/devices', async function(req, res) {
    log.trace("begin route post device");

    try {
        log.trace("route post device body=%s", req.body);

        let eventID = req.params.eventID;
        let event = await getEventStateForEvent(eventID);
        let api = getSpotifyApiForEvent(event);
        event.currentDevice = req.body.currentDevice;

        let currentState = await api.getMyCurrentPlaybackState();
        log.debug("currentState=", currentState);
        if (currentState.body.device.id != event.currentDevice) {
            log.debug("transfer playback");
            await api.transferMyPlayback({ deviceIds: [event.currentDevice], play: currentState.body.is_playing })
        } else {
            log.debug("transfer not necessary, device is already current");
        }
        let result = await getAvailableDevices(event, api);

        fireEventStateChange(event);

        res.status(200).send(result);
        log.debug("Event UPDATED eventId=%s, URL=%s", event.eventID, event.url);
    } catch (error) {
        log.error("route post device err = %s", error);
        res.status(500).send(JSON.stringify(error));
    }
    log.trace("end route post device");
});

router.post('/events/:eventID/providers/spotify/volume', async function(req, res) {
    log.trace("begin route post volume");

    try {
        log.trace("route post volume body=%s", req.body);

        let eventID = req.params.eventID;
        let event = await getEventStateForEvent(eventID);
        let api = getSpotifyApiForEvent(event);
        event.currentDevice = req.body.currentDevice;

        let currentState = await api.getMyCurrentPlaybackState();
        if (currentState && currentState.body && currentState.body.device && currentState.body.device.volume_percent) {
            let oldVolume = currentState.body.device.volume_percent;
            let newVolume = oldVolume;
            if (req.body.action == 'inc') {
                newVolume += 5;
            } else if (req.body.action == 'dec') {
                newVolume -= 5;
            }
            if (newVolume > 100) newVolume = 100;
            if (newVolume < 0) newVolume = 0;

            if (newVolume != oldVolume) {
                log.debug("Change volume to ", newVolume);
                await api.setVolume(newVolume, { device_id: event.currentDevice });
            }

            res.status(200).send({ oldVolume: oldVolume, newVolume: newVolume });
            log.debug("Event UPDATED eventId=%s, URL=%s", event.eventID, event.url);
        } else {
            res.status(404).send(JSON.stringify({
                "msg": "Can't get current volume from spotify. Is the device active? Press play in spotify app on that device to activate it, or select a different device in event settings.",
                "code": "SPTY-641"
            }));
        }
    } catch (error) {
        if (error.statusCode == 403) {
            res.status(403).send(JSON.stringify({
                "msg": "Sorry, the active spotify device does not allow volume control",
                "code": "SPTY-642"
            }));
        } else if (error.statusCode == 404) {
            res.status(404).send(JSON.stringify({
                "msg": "Spotify Device not found - is it still active? You could select a different device in event settings, or press play to let OpenDJ auto select device.",
                "code": "SPTY-643"
            }));
        } else {
            log.error("route post volume err = %s", error);
            res.status(500).send(JSON.stringify(error));
        }
    }
    log.trace("end route post volume");
});

router.delete('/events/:eventID/providers/spotify/:providerID', async function(req, res) {
    log.trace("begin route delete provider");

    try {
        log.debug("delete provider with event", req.params);
        let eventID = req.params.eventID;
        let providerID = req.params.providerID;

        let newListOfProviders = await request({
            method: 'DELETE',
            uri: PLAYLIST_PROVIDER_URL + 'events/' + eventID + '/providers',
            body: { id: providerID },
            json: true,
            timeout: 1000
        });
        log.debug('newListOfProviders', newListOfProviders);

        res.status(200).send(newListOfProviders);
    } catch (error) {
        log.error("route delete provider", error);
        res.status(500).send(JSON.stringify(error));
    }
    log.trace("end route delete provider");
});

router.get('/events/:eventID/providers/spotify/search', async function(req, res) {
    log.trace("searchTrack begin");

    let eventID = req.params.eventID;
    let query = req.query.q
    let event = await getEventStateForEvent(eventID);
    let api = getSpotifyApiForEvent(event);

    api.searchTracks(query, { limit: SPOTIFY_SEARCH_LIMIT }).then(function(data) {
        res.send(mapSpotifySearchResultToOpenDJSearchResult(data.body));
        //        res.send(data.body);
        log.trace("searchTrack end");
    }, function(err) {
        handleError(err, res);
    });
});


router.get('/events/:eventID/providers/spotify/tracks/:trackID', async function(req, res) {
    log.trace("begin route get tracks");

    try {
        let event = await getEventStateForEvent(req.params.eventID);
        let result = await getTrackDetails(event, req.params.trackID);
        res.send(result);
    } catch (err) {
        log.error("trackDetails() outer catch err=", err);
        handleError(err, res);
    }

    log.trace("end route get tracks");
});

router.get('/events/:eventID/providers/spotify/pause', async function(req, res) {
    log.trace("begin pause route");

    try {
        await pause(req.params.eventID);
        res.status(200).send("ok");
        log.info("PAUSE eventID=%s", req.params.eventID);
    } catch (err) {
        log.warn("pause failed: " + err);
        res.status(500).send(err);
    }
    log.trace("end pause route");
});


router.get('/events/:eventID/providers/spotify/play/:trackID', async function(req, res) {
    log.trace("begin play route");

    try {
        let eventID = req.params.eventID;
        let trackID = req.params.trackID;
        let pos = req.query.pos;

        await play(eventID, trackID, pos);
        res.status(200).send("ok");
    } catch (err) {
        res.status(500).send(err);
    }
    log.trace("end play route");
});

router.get('/events/:eventID/providers/spotify/playlists', async function(req, res) {
    log.trace("begin get playlists");

    try {
        let eventID = req.params.eventID;
        let event = await getEventStateForEvent(eventID);
        let api = getSpotifyApiForEvent(event);
        let data = await api.getUserPlaylists({ limit: "50" });
        let result = new Array();

        if (data.body.items) {
            data.body.items.forEach(element => result.push(mapSpotifyPlaylistToOpenDJPlaylist(element)));
        }

        res.send(result);
    } catch (err) {
        handleError(err, res);
    }
});




router.get('/events/:eventID/providers/spotify/playlist/:playlistID', async function(req, res) {
    log.trace("begin begin get playlist");

    try {
        let eventID = req.params.eventID;
        let playlistID = req.params.playlistID;
        let event = await getEventStateForEvent(eventID);
        let api = getSpotifyApiForEvent(event);
        let result = new Array();

        let data = await api.getPlaylist(playlistID, { limit: 200, offset: 0 });
        if (data.body.tracks.items) {
            data.body.tracks.items.forEach(i => result.push("spotify:" + i.track.id));
        }

        res.send(result);

    } catch (err) {
        handleError(err, res);
    }
});

async function readyAndHealthCheck(req, res) {
    log.trace("begin readyAndHealthCheck");
    // Default: not ready:
    let status = 500;
    let gridOkay = false;
    try {
        gridOkay = await checkGridConnection();
    } catch (err) {
        readyState.lastError = 'CheckGridConnection: ' + err;
    }

    if (readyState.datagridClient &&
        readyState.refreshExpiredTokens &&
        gridOkay) {
        status = 200;
    }

    res.status(status).send(JSON.stringify(readyState));
    log.trace("end readyAndHealthCheck status=", status);
}

router.get('/ready', readyAndHealthCheck);
router.get('/health', readyAndHealthCheck);

router.get('/internal/searchPlaylist', async function(req, res) {
    log.trace("begin export_playlist");

    try {
        let query = req.query.q;
        let event = await getEventStateForEvent('demo');
        let api = getSpotifyApiForEvent(event);

        let data = await api.searchPlaylists(query);
        res.send(data.body);
    } catch (err) {
        handleError(err, res);
    }
});

router.get('/internal/exportPlaylist', async function(req, res) {
    log.trace("begin export_playlist");

    try {
        let id = req.query.id;
        let delay = req.query.delay;
        let event = await getEventStateForEvent('demo');
        let api = getSpotifyApiForEvent(event);
        let trackDetails = new Array;

        log.trace("geting playlist");
        let data = await api.getPlaylist(id, { limit: 200, offset: 0 });
        let tracks = data.body.tracks.items;
        if (!delay) {
            delay = 100;
        }

        let meta = {
            id: data.body.id,
            name: data.body.name,
            description: data.body.description,
            followers: data.body.followers.total,
            owner: data.body.owner.display_name,
            url: data.body.external_urls.spotify,
        };

        log.info("exportPlaylist: Getting track details for %s tracks.", tracks.length);
        for (let i = 0; i < tracks.length; i++) {
            let trackID = tracks[i].track.id;
            let trackDetail = await getTrackDetails(event, trackID);
            trackDetails.push(trackDetail);
            log.trace("TrackID=%s", trackID);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        // res.send(data.body);
        res.send(JSON.stringify({ meta: meta, tracks: trackDetails }, null, 4));
        // res.send({ meta: meta, tracks: trackDetails });

    } catch (err) {
        handleError(err, res);
    }
});


router.get('/internal/playlists', async function(req, res) {
    log.trace("begin export_playlist");

    try {
        let event = await getEventStateForEvent('demo');
        let api = getSpotifyApiForEvent(event);

        let data = await api.getUserPlaylists('dfroehli42');
        res.send(data.body);
    } catch (err) {
        handleError(err, res);
    }
});



app.use("/api/provider-spotify/v1", router);

setImmediate(async function() {
    try {
        loadGenreMapFromFile();

        await loadSimplifiedGenresFromFile();

        await connectAllCaches();

        log.info("Initial token refresh");
        await refreshExpiredTokens();
        setInterval(refreshExpiredTokens, SPOTIFY_REFRESH_TOKEN_INTERVAL);

        app.listen(PORT, function() {
            log.info('Now listening on port *:' + PORT);
        });
    } catch (err) {
        log.fatal("!!!!!!!!!!!!!!!");
        log.fatal("init failed with err %s", err);
        log.fatal("Terminating now");
        log.fatal("!!!!!!!!!!!!!!!");
        process.exit(42);
    }
});