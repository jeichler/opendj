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

var COMPRESS_RESULT = process.env.COMPRESS_RESULT || "true";
var readyState = {
    kafkaClient: false,
    refreshExpiredTokens: false,
};

if (COMPRESS_RESULT == 'true') {
    log.info("compression enabled");
    app.use(compression())
} else {
    log.info("compression disabled");

}
app.use(cors());

function handleError(err, response) {
    log.error('Error: ' + err);
    var error = {
        "message": err,
        "code": 500
    };
    response.writeHead(500);
    response.end(JSON.stringify(error));
}



// ------------------------------------------------------------------------
// ------------------------------------------------------------------------
// ------------------------------ kafka stuff -----------------------------
// ------------------------------------------------------------------------
// ------------------------------------------------------------------------
const TOPIC_INTERNAL = "opendj-spotifyprovider-internal";

var kafkaURL = process.env.KAFKA_HOST || "localhost:9092"
var kafka = require('kafka-node')
var kafkaClient = new kafka.KafkaClient({
    kafkaHost: kafkaURL,
    connectTimeout: 1000,
    requestTimeout: 500,
    autoConnect: true,
    connectRetryOptions: {
        retries: 10,
        factor: 1,
        minTimeout: 1000,
        maxTimeout: 1000,
        randomize: true,
    },
    idleConnection: 60000,
    reconnectOnIdle: true,
});
kafkaClient.on('error', function(err) {
    log.error("kafkaClient error: %s -  reconnecting....", err);
    readyState.kafkaClient = false;
    readyState.kafkaClientError = JSON.stringify(err);
    kafkaClient.connect();
});

kafkaClient.on('connect', function(err) {
    log.info("kafkaClient connect");
    readyState.kafkaClient = true;
    readyState.kafkaClientError = "";
});

kafkaClient.connect();

// ------- Make sure topics do exit:
var topicsToCreate = [{
    topic: TOPIC_INTERNAL,
    partitions: 1,
    replicationFactor: 1,
    configEntries: [
        { name: "retention.ms", value: "43200000" }, // 12hours for start, should be 48hours!
    ]
}, ];
kafkaClient.createTopics(topicsToCreate, (error, result) => {
    log.debug("kafkaClient  createTopics error: %s", error);
    log.debug("kafkaClient  createTopics result: %s", JSON.stringify(result));
});

var kafkaProducer = new kafka.Producer(kafkaClient);

kafkaProducer.on('error', function(err) {
    log.error("kafkaProducer error: %s", err);
});

var kafkaConsumer = new kafka.Consumer(kafkaClient, [
    { topic: TOPIC_INTERNAL }, // offset, partition
], {
    autoCommit: true,
    fromOffset: true
});

kafkaConsumer.on('error', function(error) {
    log.error("kafkaConsumer error: %s", error);
});


kafkaConsumer.on('message', function(message) {
    log.debug("kafkaConsumer message: %s", JSON.stringify(message));

    if (message.topic != TOPIC_INTERNAL) {
        log.error("ignoring unexpected message %s", JSON.stringify(message));
        return;
    }
    try {
        var payload = JSON.parse(message.value);
        if (payload != null && payload.eventID != null) {
            // Idempotency - check if our internal state is already newer
            // then we should ignore this message:
            var currentState = mapOfEventStates.get(payload.eventID);
            if (currentState && Date.parse(currentState.timestamp) > Date.parse(payload.timestamp)) {
                log.info("Current state for event %s is newer than state from message - message is ignored", payload.eventID)
            } else {
                log.info("Using new state for event %s", payload.eventID);
                mapOfEventStates.set(payload.eventID, payload);
            }

            // Ensure we do not loose valuable refresh tokens:
            if (currentState && currentState.refresh_token && !payload.refresh_token) {
                log.info("New state has no refresh token, but old one has it - keeping it!");
                payload.refresh_token = currentState.refresh_token;
            }
        }
    } catch (e) {
        log.warn(" Exception %s while processing message - ignored", e);
    }
});


function fireEventStateChange(eventState) {
    log.debug("fireEventStateChange for eventID=%s", eventState.eventID);
    eventState.timestamp = new Date().toISOString();
    kafkaProducer.send([{
        topic: TOPIC_INTERNAL,
        key: eventState.eventID,
        messages: [JSON.stringify(eventState)]
    }], function(err, data) {
        log.debug("kafkaProducer.send err=%s", err);
        log.debug("kafkaProducer.send data=%s", JSON.stringify(data));
    });
    log.debug("fireEventStateChange for eventID=%s DONE", eventState.eventID);
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// ------------------------------ spotify stuff -----------------------------
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
var SpotifyWebApi = require('spotify-web-api-node');
var spotifyClientID = process.env.SPOTIFY_CLIENT_ID || "-unknown-";
var spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET || "-unknown-";
var spotifyRedirectUri = process.env.SPOTIFY_CALLBACK_URL || "-unknown-";
var spotifyScopes = ['user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing', 'playlist-modify-private'];

// Interval we check for expired tokens:
var SPOTIFY_REFRESH_TOKEN_INTERVAL = process.env.SPOTIFY_REFRESH_TOKEN_INTERVAL || "60000";

// Initial delay before we start checking for expiered token (allow for some time to have all messages processed)
var SPOTIFY_REFRESH_INITIAL_DELAY = process.env.SPOTIFY_REFRESH_INITIAL_DELAY || "1000";

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
var mapOfEventStates = new Map();


function getSpotifyApiForEvent(eventID) {
    log.trace("getSpotifyApiForEvent begin eventID=%s", eventID);
    var spotifyApi = mapOfSpotifyApis[eventID];

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
    var eventState = getEventStateForEvent(eventID);
    if (eventState.access_token != null && spotifyApi.getAccessToken() != eventState.access_token) {
        log.debug("Update API access token from state");
        spotifyApi.setAccessToken(eventState.access_token);
    }
    if (eventState.refresh_token != null && spotifyApi.getRefreshToken() != eventState.refresh_token) {
        log.debug("Update API refresh token from state");
        spotifyApi.setRefreshToken(eventState.refresh_token);
    }

    // TODO: Check if Access token did expire
    log.trace("getSpotifyApiForEvent end eventID=%s", eventID);
    return spotifyApi;
}

function getEventStateForEvent(eventID) {
    var eventState = mapOfEventStates.get(eventID);
    if (eventState == null) {
        log.debug("EvenState object created for eventID=%s", eventID);
        eventState = Object.assign({}, eventStatePrototype);
        eventState.eventID = eventID;
        eventState.timestamp = new Date().toISOString();
        mapOfEventStates.set(eventID, eventState);
    }
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

// step1: - generate the login URL / redirect...
router.get('/getSpotifyLoginURL', function(req, res) {
        log.debug("getSpotifyLoginURL");

        // TODO: Error handling if EventID is not presenet
        var eventID = req.query.event;
        var spotifyApi = getSpotifyApiForEvent(eventID);
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
router.get('/auth_callback', function(req, res) {
    log.trace("auth_callback start req=%s", JSON.stringify(req.query));
    var code = req.query.code;
    var state = req.query.state;
    var eventID = state;
    log.debug("code = %s, state=%s", code, state);

    // TODO: Check on STATE!

    // Trade CODE into TOKENS:
    log.debug("authorizationCodeGrant with code=%s", code);
    var spotifyApi = getSpotifyApiForEvent(eventID);
    spotifyApi.authorizationCodeGrant(code).then(
        function(data) {
            log.debug("authorization code granted for eventID=%s!", eventID);

            // Set tokens on the Event Object to use it in later spotify API calls:
            var eventState = getEventStateForEvent(eventID);
            updateEventTokensFromSpotifyBody(eventState, data.body);
            fireEventStateChange(eventState);

            // TODO: Sent a decent response, actually we need to redirect to a url
            // given in state!
            res.send('1');
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

        var api = getSpotifyApiForEvent(event.eventID);
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

function refreshExpiredTokens() {
    log.trace("refreshExpiredTokens begin");
    mapOfEventStates.forEach(refreshAccessToken);
    readyState.refreshExpiredTokens = true;

    log.trace("refreshExpiredTokens end");
}




router.get('/getCurrentTrack', function(req, res) {
    log.debug("getCurrentTrack");

    // TODO: Error handling if EventID is not present
    var eventID = req.query.event;
    var api = getSpotifyApiForEvent(eventID);

    api.getMyCurrentPlaybackState({}).then(function(data) {
        log.debug("Now Playing: ", data.body);
        res.send(data.body);
    }, function(err) {
        handleError(err, res);
    });

});
router.get('/getAvailableDevices', function(req, res) {
    log.trace("getAvailableDevices begin");

    // TODO: Error handling if EventID is not present
    var eventID = req.query.event;
    var api = getSpotifyApiForEvent(eventID);

    api.getMyDevices().then(function(data) {
        log.debug("getAvailableDevices:", data.body);
        res.send(data.body);
    }, function(err) {
        handleError(err, res);
    });

    log.trace("getAvailableDevices end");
});

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
    var result = currentString;

    if (arrayOfStrings && arrayOfStrings.length > 0) {
        var i;
        for (i = 0; i < maxEntries; i++) {
            if (i >= arrayOfStrings.length || timesCharExistInString(result, ',') + 1 >= maxEntries) break;
            if (result.length > 0) result += ", ";
            result += arrayOfStrings[i];
        }
    }
    return result;
}

function mapSpotifyTrackResultsToOpenDJTrack(trackResult, albumResult, artistResult, audioFeaturesResult) {
    var result = {};
    if (trackResult && trackResult.body) {
        result = mapSpotifyTrackToOpenDJTrack(trackResult.body);
    }

    result.genre = "";
    if (albumResult && albumResult.body) {
        result.genre = collapseArrayIntoSingleString(result.genre, albumResult.body.genres, SPOTIFY_TRACK_DETAIL_NUM_GENRES);
    }

    if (artistResult && artistResult.body) {
        result.genre = collapseArrayIntoSingleString(result.genre, artistResult.body.genres, SPOTIFY_TRACK_DETAIL_NUM_GENRES);
    }

    if (audioFeaturesResult && audioFeaturesResult.body) {
        result.danceability = Math.round(audioFeaturesResult.body.danceability * 100);
        result.energy = Math.round(audioFeaturesResult.body.energy * 100);
        result.acousticness = Math.round(audioFeaturesResult.body.acousticness * 100);
        result.instrumentalness = Math.round(audioFeaturesResult.body.instrumentalness * 100);
        result.liveness = Math.round(audioFeaturesResult.body.liveness * 100);
        result.happiness = Math.round(audioFeaturesResult.body.valence * 100);
        result.bpm = Math.round(audioFeaturesResult.body.tempo);
    }

    return result;
}

router.get('/searchTrack', function(req, res) {
    log.trace("searchTrack begin");

    // TODO: Error handling if EventID is not present
    var eventID = req.query.event;
    var query = req.query.q
    var api = getSpotifyApiForEvent(eventID);

    api.searchTracks(query, { limit: SPOTIFY_SEARCH_LIMIT }).then(function(data) {
        res.send(mapSpotifySearchResultToOpenDJSearchResult(data.body));
        //        res.send(data.body);
        log.trace("searchTrack end");
    }, function(err) {
        handleError(err, res);
    });
});

var mapOfTrackDetails = new Map();

router.get('/trackDetails', async function(req, res) {
    log.trace("trackDetails begin");

    try {

        // TODO: Error handling if EventID is not present
        var eventID = req.query.event;
        var trackID = req.query.track
        var trackResult = null;
        var audioFeaturesResult = null;
        var albumResult = null;
        var artistResult = null;
        var result = null;

        // TODO: Error handling if API is not defined:
        var api = getSpotifyApiForEvent(eventID);

        log.debug("trackDetails eventID=%s, trackID=%s", eventID, trackID);

        // If TrackID contains a "spotify:track:" prefix, we need to remove it:
        var colonPos = trackID.lastIndexOf(":");
        if (colonPos != -1) {
            trackID = trackID.substring(colonPos + 1);
        }

        // CACHING, as the following is quite Expensive, and we would like
        // to avoid to run into Spotify API rate limits:
        result = mapOfTrackDetails.get(trackID);
        if (result) {
            log.debug("trackDetails cache hit");
        } else {
            log.debug("trackDetails cache miss");

            // We have to make four calls - we do that in parallel to speed things up
            // The problem is the "Genre" Result - it's not stored with the track, but with
            // either the album or the artist. So here we go:
            // #1: Get basic Track Result:
            trackResult = api.getTrack(trackID);

            // #2: Get get Track Audio Features (danceability, energy and stuff):
            audioFeaturesResult = api.getAudioFeaturesForTrack(trackID);

            // When we have trackResult we get the album and artist ID , and with that, we can make call 
            // #3 to get album details and ...
            trackResult = await trackResult;

            if (trackResult && trackResult.body && trackResult.body.album && trackResult.body.album.id) {
                albumResult = api.getAlbum(trackResult.body.album.id);
            }

            // ... call #4 to get Artist Result:
            if (trackResult && trackResult.body && trackResult.body.artists && trackResult.body.artists.length > 0) {
                artistResult = api.getArtist(trackResult.body.artists[0].id);
            }

            // Wait for all results to return:
            albumResult = await albumResult;
            audioFeaturesResult = await audioFeaturesResult;
            artistResult = await artistResult;

            // TODO: Merge responses into OpenDJ TrackResult 
            // For now (and debugging), we send the raw: spotify objects:
            result = mapSpotifyTrackResultsToOpenDJTrack(trackResult, albumResult, artistResult, audioFeaturesResult);

            // Cache result:
            mapOfTrackDetails.set(trackID, result);
        }

        res.send(result);
        /*
            res.send({
                track: trackResult,
                album: albumResult,
                artist: artistResult,
                audioFeaturesResult: audioFeaturesResult,
                result: result,
            });
         */

    } catch (err) {
        handleError(err, res);
    }

    log.trace("trackDetails end");

});

router.get('/pause', async function(req, res) {
    log.trace("begin pause ");

    try {
        var eventID = req.query.event;
        var api = getSpotifyApiForEvent(eventID);
        var event = getEventStateForEvent(eventID);

        await api.pause({ device_id: event.currentDevice });
        res.status(200).send("ok");
        log.info("PAUSE eventID=%s", eventID);
    } catch (err) {
        log.warn("pause failed: " + err);
        res.status(500).send(err);
    }
    log.trace("end pause");
});



router.get('/play', async function(req, res) {
    log.trace("begin play ");

    try {
        var eventID = req.query.event;
        var trackID = req.query.track;
        var pos = req.query.pos;
        var api = getSpotifyApiForEvent(eventID);
        var event = getEventStateForEvent(eventID);

        log.debug("play eventID=%s, trackID=%s, pos=%s", eventID, trackID, pos);


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

            log.debug("sending 200 ok");
            res.status(200).send("ok");
        } catch (err) {
            log.trace("begin first catch");
            try {
                await handlePlayError(err, res, options, event, api)
                res.status(200).send({ code: "SPTFY-200", msg: "needed to handle spotify error, maybe device was changed!" });
            } catch (err2) {
                log.debug("catching 2nd error -send 500 err", err2)
                    // res.status(500).send({ code: "SPTFY-500", msg: "play failed despite retries! InitialErr=" + err + " SecondErr=" + JSON.stringify(err2 });
                res.status(500).send(err2);

            }
            log.trace("end first catch");
        }

        log.debug("after promiseRetry");


        // Todo: verify via currentTrack that player is actually playing!

    } catch (err) {
        log("handleError " + err);
        handleError(err, res);
    }
    log.trace("end play");
});

async function handlePlayError(err, res, options, event, api) {
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


router.get('/ready', function(req, res) {
    log.trace("ready begin");
    // Default: not ready:
    var status = 500;
    if (readyState.kafkaClient &&
        readyState.refreshExpiredTokens) {
        status = 200;
    }

    res.status(status).send(JSON.stringify(readyState));
});



// Problem: Init of 10 Pods concurrently and expiered tokens, - we need to avoid concurrent token refresh
// (actually we need to test that - could be that with a new refresh tokens, the 2nd call fails).
// Other approach: readiness check = false, wait a random interval 0-30 seconds, then check for expiered tokens. Assumption: one  pod checks first for expiered tokens and does the update, other pods get notified and when their interval experies, they see only current tokens.

// TODO: Implement Health and Readiness check.

// TODO: Implement token refresh during runtime - check every minute or so if tokens expy in the near future. Use a random interval for "near future" to avoid concurrent refreshs. If a refresh fails, we assume that another pod tried it already.
// If refresh_failure counter is too high, we notify to EventOwner.

// TODO: Implement Retries on Spotify API Calls.


if (typeof spotifyClientID !== 'undefined' && spotifyClientID) {
    log.log("spotifyClientID is defined via env variable- using the real thing...");

    app.use('/play', require('./lib/player.js')());
    app.use('/currentTrack', require('./lib/currentTrack.js')());
    app.use('/trackInfo', require('./lib/trackInfo.js')());
} else {
    log.log("spotifyClientID is NOT defined via env variable- using the mockup...");

    var mockup = require('./lib/mockup.js');
    app.use('/play', mockup["play"]);
    app.use('/currentTrack', mockup["currentTrack"]);
    app.use('/trackInfo', mockup["trackInfo"]);
}



//var swaggerUi = require('swagger-ui-express'),
//swaggerDocument = require('./swagger.json');
//app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use("/api/provider-spotify/v1", router);

// Wait 5 seconds for all messages to be processed, then check once for expired tokens:
setTimeout(refreshExpiredTokens, SPOTIFY_REFRESH_INITIAL_DELAY);

setInterval(refreshExpiredTokens, SPOTIFY_REFRESH_TOKEN_INTERVAL);

module.exports = app;