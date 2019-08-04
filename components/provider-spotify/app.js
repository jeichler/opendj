'use strict';

const compression = require('compression');
const express = require('express');
const app = express();
var cors = require('cors');
var promiseRetry = require('promise-retry');
var router = new express.Router();
var log4js = require('log4js')
var log = log4js.getLogger();
log.level = process.env.LOG_LEVEL || "trace";

const PORT = process.env.PORT || 8080;
const COMPRESS_RESULT = process.env.COMPRESS_RESULT || "true";
var readyState = {
    datagridClient: false,
    refreshExpiredTokens: false,
    lastError: ""
};


// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// ------------------------------ datagrid stuff -----------------------------
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
const DATAGRID_URL = process.env.DATAGRID_URL || "localhost:11222"
const datagrid = require('infinispan');
var tracksCache = null;
var stateCache = null;

async function connectToCache(name) {
    let cache = null;
    try {
        log.debug("begin connectToCache %s", name);
        let splitter = DATAGRID_URL.split(":");
        let host = splitter[0];
        let port = splitter[1];
        cache = await datagrid.client([{ host: host, port: port }], { cacheName: name, mediaType: 'application/json' });
        readyState.datagridClient = true;
        log.info("connected to grid %s", name);
    } catch (err) {
        readyState.datagridClient = false;
        readyState.lastError = err;
        throw "DataGrid connection FAILED with err " + err;
    }

    return cache;
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
    putIntoCacheAsync(stateCache, event.eventID, event);
    log.trace("end fireEventStateChange");
}

function handleCacheError(cache, err) {
    log.error("Cache error: %s", err);
    log.error("cache=%s", JSON.stringify(cache));
    readyState.datagridClient = false;
    readyState.lastError = err;
    //TODO: Try to reconnect
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// ------------------- spotify authentication stuff -------------------------
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
var SpotifyWebApi = require('spotify-web-api-node');
var spotifyClientID = process.env.SPOTIFY_CLIENT_ID || "-unknown-";
var spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET || "-unknown-";
var spotifyRedirectUri = process.env.SPOTIFY_CALLBACK_URL || "-unknown-";
var spotifyScopes = ['user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing', 'playlist-modify-private'];

// Interval we check for expired tokens:
var SPOTIFY_REFRESH_TOKEN_INTERVAL = process.env.SPOTIFY_REFRESH_TOKEN_INTERVAL || "60000";


// Offset we refresh a token BEFORE it expires - to be sure, we do this 5 minutes BEFORE
// it expires:
var SPOTIFY_REFRESH_TOKEN_OFFSET = process.env.SPOTIFY_REFRESH_TOKEN_OFFSET || "300000";

// To avoid that several pods refresh at the same time, we add some random
// value (up to 3 min) to the offset:
var SPOTIFY_REFRESH_TOKEN_OFFSET_RANDOM = process.env.SPOTIFY_REFRESH_TOKEN_OFFSET_RANDOM || "180000";

// Number of genres to return for track details:
var SPOTIFY_TRACK_DETAIL_NUM_GENRES = process.env.SPOTIFY_TRACK_DETAIL_NUM_GENRES || "2";
var SPOTIFY_TRACK_DETAIL_NUM_ARTISTS = process.env.SPOTIFY_TRACK_DETAIL_NUM_ARTISTS || "2";

var SPOTIFY_SEARCH_LIMIT = process.env.SPOTIFY_SEARCH_LIMIT || "20";

var SPOTIFY_AUTOSELECT_DEVICE = (process.env.SPOTIFY_AUTOSELECT_DEVICE || 'true') == 'true';
var SPOTIFY_RETRIES = process.env.SPOTIFY_RETRIES || "1";;
var SPOTIFY_RETRY_TIMEOUT_MIN = process.env.SPOTIFY_RETRY_TIMEOUT_MIN || "1000";
var SPOTIFY_RETRY_TIMEOUT_MAX = process.env.SPOTIFY_RETRY_TIMEOUT_MAX || "1000";


// Map of Spotify API Objects:
// Key: EventID
// Value: SpotifyWebApi Object
var mapOfSpotifyApis = {
    "42": null
}

// Example Object for an Event State - this is clone for all events:
var eventStatePrototype = {
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
    let eventState = await getFromCache(stateCache, eventID);
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
    var now = new Date();
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
        var eventID = req.params.eventID;
        var event = await getEventStateForEvent(eventID);
        var spotifyApi = getSpotifyApiForEvent(event);
        var authorizeURL = spotifyApi.createAuthorizeURL(spotifyScopes, eventID);
        log.debug("authorizeURL=%s", authorizeURL);

        // Unless we have an event regisgration page, we
        // redirect for convience:
        res.redirect(authorizeURL);

        // If we go for the real thing, we need to send the URL:
    } //   res.send(authorizeURL);
);

// This is Step 2 of the Authorization Code Flow: 
// Redirected from Spotiy AccountsService after user Consent.
// We receive a code and need to trade that token into tokens:
router.get('/auth_callback', async function(req, res) {
    log.trace("auth_callback start req=%s", JSON.stringify(req.query));
    var code = req.query.code;
    var state = req.query.state;
    var eventID = state;
    log.debug("code = %s, state=%s", code, state);

    // TODO: Check on STATE!

    // Trade CODE into TOKENS:
    log.debug("authorizationCodeGrant with code=%s", code);
    var eventState = await getEventStateForEvent(eventID);
    var spotifyApi = getSpotifyApiForEvent(eventState);
    spotifyApi.authorizationCodeGrant(code).then(
        async function(data) {
            try {


                log.debug("authorization code granted for eventID=%s!", eventID);

                // Set tokens on the Event Object to use it in later spotify API calls:
                let continueWith = "/events/" + eventID + "/owner";
                updateEventTokensFromSpotifyBody(eventState, data.body);
                fireEventStateChange(eventState);

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
                log.error("authorizationCodeGrant processing failed for event %s with err %s", eventID, err);
            }
        },
        function(err) {
            log.debug('authorization code granted  err=%s', err);
            handleError(err, res);
        }
    );
});

// Step 3 is using the access_token - omitted here for obvious reasons.

// Step 4 of the flow - refresh tokens!
function refreshAccessToken(event) {
    log.trace("refreshAccessToken begin eventID=%s", event.eventID);

    if (!event.token_expires) {
        log.debug("refreshAccessToken: event has no token_expires, nothing to do here");
        return;
    }

    var expTs = Date.parse(event.token_expires);
    var expTsOrig = expTs;
    var now = Date.now();

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
        log.info("refreshAccessToken: access token for eventID=%s is about to expire in %s sec - initiating refresh... ", event.eventID, (expTsOrig - now) / 1000);

        var api = getSpotifyApiForEvent(event);
        api.refreshAccessToken().then(
            function(data) {
                log.info("access token for^ eventID=%s is expired - initiating refresh...SUCCESS", event.eventID);
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
        log.debug("refreshAccessToken: toking for eventID=%s  is still valid", event.eventID);
    }
    log.trace("refreshAccessToken end eventID=%s", event.eventID);
}

async function refreshExpiredTokens() {
    log.trace("refreshExpiredTokens begin");
    try {
        let it = await stateCache.iterator(10);
        log.trace("it = %s", JSON.stringify(it));
        let entry = await it.next();

        while (!entry.done) {
            log.trace("event = %s", JSON.stringify(entry));
            refreshAccessToken(JSON.parse(entry.value));
            entry = await it.next();
        }

        await it.close();

        readyState.refreshExpiredTokens = true;
    } catch (err) {
        readyState.refreshExpiredTokens = false;
        log.fatal("refreshExpiredTokens failed with err %s", err)
    }

    log.trace("refreshExpiredTokens end");
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// ----------------------- spotify track logic ------------------------------
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
function mapSpotifyTrackToOpenDJTrack(sptTrack) {
    var odjTrack = {};
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
        odjTrack.image_url = sptTrack.album.images[sptTrack.album.images.length - 1].url
    } else {
        // TODO: Return URL to OpenDJ Logo
        odjTrack.image_url = "";
    }

    odjTrack.duration_ms = sptTrack.duration_ms
    odjTrack.preview = sptTrack.preview_url;
    odjTrack.popularity = sptTrack.popularity;
    odjTrack.provider = "spotify";

    return odjTrack;
}


function mapSpotifySearchResultToOpenDJSearchResult(spotifyResult) {
    var result = [];
    for (let sptTrack of spotifyResult.tracks.items) {
        result.push(mapSpotifyTrackToOpenDJTrack(sptTrack));
    }

    return result;
}

function timesCharExistInString(str, chr) {
    var total = 0,
        last_location = 0,
        single_char = (chr + '')[0];
    while (last_location = str.indexOf(single_char, last_location) + 1) {
        total = total + 1;
    }
    return total;
};

function collapseArrayIntoSingleString(currentString, arrayOfStrings, maxEntries) {
    log.trace("begin collapseArrayIntoSingleString current=%s, array=%s, max=%i", currentString, arrayOfStrings, maxEntries);
    var result = currentString;

    if (arrayOfStrings && arrayOfStrings.length > 0) {
        var numEntries = timesCharExistInString(result, ',');
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
    var result = {};
    if (trackResult && trackResult.body) {
        result = mapSpotifyTrackToOpenDJTrack(trackResult.body);
    }

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

async function getTrackDetails(eventID, trackID) {
    log.trace("begin getTrackDetails eventID=%s, trackID=%s", eventID, trackID);

    let trackResult = null;
    let audioFeaturesResult = null;
    let albumResult = null;
    let artistResult = null;
    let result = null;
    let event = await getEventStateForEvent(eventID);
    let api = getSpotifyApiForEvent(event);

    // If TrackID contains a "spotify:track:" prefix, we need to remove it:
    var colonPos = trackID.lastIndexOf(":");
    if (colonPos != -1) {
        trackID = trackID.substring(colonPos + 1);
    }

    // CACHING, as the following is quite Expensive, and we would like
    // to avoid to run into Spotify API rate limits:
    try {
        result = await getFromCache(tracksCache, "spotify:" + trackID);
    } catch (cacheFailed) {
        log.warn("DataGrid GET TRACKS failed - ignoring error %s", cacheFailed);
    }

    if (result) {
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
        putIntoCacheAsync(tracksCache, "spotify:" + trackID, result);
    }

    log.trace("end getTrackDetails");
    return result;
}


async function pause(eventID) {
    log.trace("begin pause ");

    var event = await getEventStateForEvent(eventID);
    var api = getSpotifyApiForEvent(event);

    await api.pause({ device_id: event.currentDevice });
    log.info("PAUSE eventID=%s", eventID);

    log.trace("end pause");
}



async function play(eventID, trackID, pos) {
    log.trace("begin play");

    log.debug("play eventID=%s, trackID=%s, pos=%s", eventID, trackID, pos);
    var event = await getEventStateForEvent(eventID);
    var api = getSpotifyApiForEvent(event);



    // If TrackID contains a "spotify:track:" prefix, we need to remove it:
    var colonPos = trackID.lastIndexOf(":");
    if (colonPos != -1) {
        trackID = trackID.substring(colonPos + 1);
    }
    var uris = ["spotify:track:" + trackID];
    var options = { uris: uris };

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
            await handlePlayError(err, options, event, api);
            log.debug("play was successful after handling initial error");
            // res.status(200).send({ code: "SPTFY-200", msg: "needed to handle spotify error, maybe device was changed!" });
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
        var deviceChanged = await autoSelectDevice(api, event);
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
    var data = await api.getMyDevices()
    log.debug("Response from spotify getMyDevices: " + JSON.stringify(data.body));
    var devices = data.body.devices;
    var result = false;
    if (devices.length == 0) {
        log.debug("device list is empty");
        throw { code: "SPTFY-100", msg: "No devices available - Please start spotify on the desired playback device" };
    }
    // Per default, we take the first device. If there is an active
    // one, we prefer that:
    var deviceId = devices[0].id;
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

function handleError(err, response) {
    log.error('Error: ' + err);
    if (err.code && err.msg) {
        response.status(500).send(err);
    } else {
        response.status(500).send({
            "msg": err,
            "code": "SPTY-542"
        });

    }
}

router.get('/events/:eventID/providers/spotify/currentTrack', async function(req, res) {
    log.debug("getCurrentTrack");

    var eventID = req.params.eventID;
    var event = await getEventStateForEvent(eventID);
    var api = getSpotifyApiForEvent(event);

    api.getMyCurrentPlaybackState({}).then(function(data) {
        log.debug("Now Playing: ", data.body);
        res.send(data.body);
    }, function(err) {
        handleError(err, res);
    });

});

router.get('/events/:eventID/providers/spotify/devices', async function(req, res) {
    log.trace("getAvailableDevices begin");

    var eventID = req.params.eventID;
    var event = await getEventStateForEvent(eventID);
    var api = getSpotifyApiForEvent(event);

    api.getMyDevices().then(function(data) {
        log.debug("getAvailableDevices:", data.body);
        res.send(data.body);
    }, function(err) {
        handleError(err, res);
    });

    log.trace("getAvailableDevices end");
});


router.get('/events/:eventID/providers/spotify/search', async function(req, res) {
    log.trace("searchTrack begin");

    var eventID = req.params.eventID;
    var query = req.query.q
    var event = await getEventStateForEvent(eventID);
    var api = getSpotifyApiForEvent(event);

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
        let result = await getTrackDetails(req.params.eventID, req.params.trackID);
        res.send(result);
    } catch (err) {
        log.error("trackDetails() outer catch err=", err);
        handleError(err, res);
    }

    log.trace("end route get tracks");
});


// TODO - REFACTOR THIS TO ABOVE BUSINESS LOGIC, to be reused by async API
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
        var eventID = req.params.eventID;
        var trackID = req.params.trackID;
        var pos = req.query.pos;

        await play(eventID, trackID, pos);
        res.status(200).send("ok");
    } catch (err) {
        res.status(500).send(err);
    }
    log.trace("end play route");
});


router.get('/ready', function(req, res) {
    log.trace("ready begin");
    // Default: not ready:
    var status = 500;
    if (readyState.datagridClient &&
        readyState.refreshExpiredTokens) {
        status = 200;
    }

    res.status(status).send(JSON.stringify(readyState));
});




app.use("/api/provider-spotify/v1", router);


function onCacheEntryModified(key, entryVersion, listenerID) {
    log.debug("onCacheEntryModified key=%s, entryVersion=%s, listenerID=%s", key, entryVersion, listenerID);
}

setImmediate(async function() {
    try {
        tracksCache = await connectToCache("TRACKS");
        stateCache = await connectToCache("PROVIDER_SPOTIFY_STATE");

        await refreshExpiredTokens();
        //    setInterval(refreshExpiredTokens, SPOTIFY_REFRESH_TOKEN_INTERVAL);

        /* Sample Listener
        log.debug("Adding cache listener");
        let listenerID = await tracksCache.addListener('create', onCacheEntryModified);
        await tracksCache.addListener('modify', onCacheEntryModified, { listenerId: listenerID });
        await tracksCache.addListener('remove', onCacheEntryModified, { listenerId: listenerID });
        await tracksCache.addListener('expiry', onCacheEntryModified, { listenerId: listenerID });
*/

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