'use strict';

const compression = require('compression');
const express = require('express');
const app = express();
var request = require('request-promise-native');
var kafka = require('kafka-node')
var router = new express.Router();
var log4js = require('log4js')
var log = log4js.getLogger();
log.level = process.env.LOG_LEVEL || "trace";

var COMPRESS_RESULT = process.env.COMPRESS_RESULT || "true";
var readyState = {
    kafkaClient: false,
};

if (COMPRESS_RESULT == 'true') {
    log.info("compression enabled");
    app.use(compression())
} else {
    log.info("compression disabled");

}

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
const TOPIC_PLAYLIST = "opendj.data.playlist";

var kafkaURL = process.env.KAFKA_HOST || "localhost:9092"
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

var kafkaProducer = new kafka.Producer(kafkaClient);

kafkaProducer.on('error', function(err) {
    log.error("kafkaProducer error: %s", err);
});

var kafkaConsumer = new kafka.Consumer(kafkaClient, [
    { topic: TOPIC_PLAYLIST }, // offset, partition
], {
    autoCommit: true,
    fromOffset: true
});

kafkaConsumer.on('error', function(error) {
    log.error("kafkaConsumer error: %s", error);
    readyState.kafkaClient = false;
    readyState.kafkaClientError = "Consumer:" + JSON.stringify(error);
});

kafkaConsumer.on('message', function(message) {
    return;

    log.debug("kafkaConsumer message: %s", JSON.stringify(message));

    if (message.topic != "IGNORE ME FOR THE MOMENT") {
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


function firePlaylistChangedEvent(event, playlist) {
    log.debug("firePlaylistChangedEvent for event=%s, playlist=%s", event.eventID, playlist.playlistID);
    kafkaProducer.send([{
        topic: TOPIC_PLAYLIST,
        key: event.eventID + ":" + playlist.playlistID,
        messages: [JSON.stringify(playlist)]
    }], function(err, data) {
        if (err) {
            log.error("kafkaProducer.send err=%s", err);
            readyState.kafkaClient = false;
            readyState.kafkaClientError = JSON.stringify(err);
        }
    });
    log.trace("end firePlaylistChangedEvent for event=%s, playlist=%s", event.eventID, playlist.playlistID);
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// ------------------------------ playlist stuff -----------------------------
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------

// Interval we check for expired tokens:
var SPOTIFY_PROVIDER_URL = process.env.SPOTIFY_PROVIDER_URL || "http://localhost:8080/api/provider-spotify/v1/";

// Default for emergenceAddToPlaylist:
var DEFAULT_AUTOFILL_EMPTY_PLAYLIST = (process.env.DEFAULT_AUTOFILL_EMPTY_PLAYLIST || 'true') == 'true';
var DEFAULT_IS_PLAYING = (process.env.DEFAULT_IS_PLAYING || 'true') == 'true';
var MOCKUP_AUTOSKIP = parseInt(process.env.MOCKUP_AUTOSKIP_SECONDS || '0') * 1000;
var INTERNAL_POLL_INTERVAL = parseInt(process.env.INTERNAL_POLL_INTERVAL || '100');


// Key: EventID: Object: Event
var mapOfEvents = new Map([
    ["0", {
        eventID: "0",
        autoFillEmptyPlaylist: DEFAULT_AUTOFILL_EMPTY_PLAYLIST,
        playlists: [{
            playlistID: 0,
            isPlaying: DEFAULT_IS_PLAYING,
            //            currentTrackStartedAt: 0,
            //            currentTrackPauseAt: 0,
            currentTrack: null,
            nextTracks: []
        }]
    }],
]);

var emergencyTrackIDs = [
    "spotify:029NqmIySn1kOY305AAhxT", // Sledgehammer by Peter Gabrial
    "spotify:0DfG1ltJnZyq4Tx3ZLL7ZU", // Rock me Amadeus by Falco
    "spotify:4pbJqGIASGPr0ZpGpnWkDn", // We Will Rock You by Queen
    "spotify:5ftamIDoDRpEvlZinDuNNW", // Flip Ya Lid by Nightmares on Wax
    "spotify:6u7jPi22kF8CTQ3rb9DHE7", // Old Town Road by Lil Nas X, Billy Ray Cyrus
    "spotify:1NaxD6BhOQ69C4Cdcx5jrP", // Coming Down by KIDDO, GASHI
    "spotify:720dTtTyYAD9TKSAd9lwrt", // Jimmy Mathis by "Bubba Sparxxx
    "spotify:72GtVxWzQSeF7xT4wr3fE0", // Shadow On The Wall by Mike Oldfield
    "spotify:3vkQ5DAB1qQMYO4Mr9zJN6", // Gimme! Gimme! Gimme!  by ABBA
    "spotify:3Wz5JAW46aCFe1BwZIePu6", // Old On by OLSSON

];

async function getTrackDetailsForTrackID(eventID, trackID) {
    log.trace("getTrackDetailsForTrackID begin");
    var result = await request(SPOTIFY_PROVIDER_URL + "trackDetails?event=" + eventID + "&track=" + trackID, { json: true })
    log.trace("getTrackDetailsForTrackID end result=%s", JSON.stringify(result));
    return result;
}

async function createAutofillPlayList(eventID) {
    log.trace("createAutofillPlayList begin eventID=%s", eventID);
    var result = [];
    log.info("AUTOFILL event=%s", eventID);

    for (let trackID of emergencyTrackIDs) {
        var track = await getTrackDetailsForTrackID(eventID, trackID);
        track.added_by = "OpenDJ";
        result.push(track);
    }
    log.trace("createAutofillPlayList end eventID=%s result=%s", eventID, JSON.stringify(result));
    return result;
}

function updateCurrentTrackProgress(playlist) {
    if (playlist.isPlaying && playlist.currentTrack) {
        var newPos = Date.now() - Date.parse(playlist.currentTrack.started_at);
        if (newPos < 0) {
            newPos = 0;
        } else if (newPos > playlist.currentTrack.duration_ms) {
            newPos = playlist.currentTrack.duration_ms
        }
        playlist.currentTrack.progress_ms = newPos;
    }
}

function play(event, playlist) {
    log.trace("play begin event=%s, playlist=%s", event.eventID, playlist.playlistID);

    playlist.isPlaying = true;
    if (!playlist.currentTrack) {
        log.debug("play without current track - skipping to next/first track")
        skip(event, playlist);
        // Skip will call play again if possible, so we can now
        return;
    }

    var now = Date.now();
    if (playlist.currentTrack.progress_ms > 0) {
        log.debug("PLAY: actually it is a resume, adjusting started_at");
        now -= playlist.currentTrack.progress_ms;
    }
    playlist.currentTrack.started_at = new Date(now).toISOString();

    updateCurrentTrackProgress(playlist);

    // TODO: Call Spotify-Provider to play at currentTrack.progress_ms
    log.info("PLAY event=%s, playlist=%s, track=%s, startAt=%s", event.eventID, playlist.playlistID, playlist.currentTrack.id, playlist.currentTrack.progress_ms);

    log.trace("play end event=%s, playlist=%s", event.eventID, playlist.playlistID);
}

function pause(event, playlist) {
    log.info("PAUSE event=%s, playlist=%s", event.eventID, playlist.playlistID);
    // Make sure we take note of the current progress:
    updateCurrentTrackProgress(playlist);
    playlist.isPlaying = false;

    // TODO: Call Spotify-Provider to pause
}


function skip(event, playlist) {
    log.trace("skip begin");
    log.info("SKIP event=%s, playlist=%s", event.eventID, playlist.playlistID);
    playlist.currentTrack = playlist.nextTracks.shift();
    if (playlist.currentTrack) {
        playlist.currentTrack.progress_ms = 0;
        if (playlist.isPlaying) {
            play(event, playlist);
        }
    } else {
        log.info("SKIP: reached end of playlist");
        playlist.currentTrack = null;
    }
    log.trace("skip end");
}

function isTrackPlaying(playlist) {
    var result = false;
    log.trace("isTrackPlaying begin id=%s", playlist.playlistID);

    if (playlist.isPlaying) {
        if (playlist.currentTrack) {
            log.trace("   current track is present");
            updateCurrentTrackProgress(playlist);
            var currentPos = playlist.currentTrack.progress_ms;

            if (currentPos > 0) {
                log.trace("   currentPos=%s s", currentPos / 1000);
                if (currentPos >= playlist.currentTrack.duration_ms) {
                    log.trace("   currentPos after duration");
                    result = false;
                } else if (currentPos < 0) {
                    log.error("isTrackPlaying: currentPos is negative????");
                    result = false;
                } else {
                    log.trace("   currentPos is within duration");
                    if (MOCKUP_AUTOSKIP > 0 && currentPos > MOCKUP_AUTOSKIP) {
                        log.warn("AutoSkipping");
                        result = false;
                    } else {
                        result = true;
                    }
                }
            } else {
                log.error("isTrackPlaying: currentTrackStartedAt is zero???");
                result = false;
            }
        } else {
            log.trace("   No current track");
            result = false;
        }
    } else {
        log.trace("Playlist is not playing, so track neither");
        result = false;
    }

    log.trace("isTrackPlaying end id=%s result=%s", playlist.playlistID, result);
    return result;
}

async function checkPlaylist(event, playlist) {
    log.trace("checkPlaylist begin");
    var stateChanged = false;
    if (playlist.nextTracks.length == 0) {
        log.trace("playlist is empty");
        if (event.autoFillEmptyPlaylist) {
            log.info("AutoFilling Playlist %s of event %s", playlist.playlistID, event.eventID);
            playlist.nextTracks = await createAutofillPlayList(event.eventID);
            stateChanged = true;
        }
    } else {
        log.trace("playlist has tracks");
    }

    if (playlist.isPlaying && !isTrackPlaying(playlist)) {
        skip(event, playlist);
        stateChanged = true;
    }

    if (stateChanged)
        firePlaylistChangedEvent(event, playlist);

    log.trace("checkPlaylist end stateChanged=%s", stateChanged);
    return stateChanged;
}

async function checkEvent(event) {
    log.trace("checkEvent begin");
    var stateChanged = false;

    if (event.playlists == null) {
        log.trace("creating playlists");
        event.playlists = [{
            playlistID: 0,
            isPlaying: DEFAULT_IS_PLAYING,
            currentTrack: null,
            currentTrackStartedAt: 0,
            currentTrackPausedAt: 0,
            nextTracks: []
        }];
        stateChanged = true;
    }

    for (let playlist of event.playlists) {
        stateChanged = stateChanged || await checkPlaylist(event, playlist);
    }
    log.trace("checkEvent end stateChanged=%s", stateChanged);
}

function checkEvents() {
    log.trace("checkEvents begin");
    mapOfEvents.forEach(checkEvent);
    log.trace("checkEvents end");
}


// ------------------------------------  Routes ---------------------

// Make sure we update progress field of current Track, if we hand out
// Track Info:
function uglyTrackProgressUpdater() {
    mapOfEvents.forEach(function(event) {
        for (let playlist of event.playlists) {
            updateCurrentTrackProgress(playlist);
        }
    });
}

function getEventForRequest(req) {
    return mapOfEvents.get(req.params.eventID);
}

function getPlaylistForRequest(req) {
    return getEventForRequest(req).playlists[req.params.listID];
}

router.get('/events/', function(req, res) {
    log.trace("begin GET events");
    uglyTrackProgressUpdater();
    res.status(200).send(mapOfEvents);
});

router.get('/events/:eventID', function(req, res) {
    log.trace("begin GET event eventId=%s", req.params.eventID);
    uglyTrackProgressUpdater();
    res.status(200).send(getEventForRequest(req));
});

router.get('/events/:eventID/playlists/', function(req, res) {
    log.trace("begin GET playlists eventId=%s, listId=%s", req.params.eventID, req.params.listID);
    uglyTrackProgressUpdater();
    res.status(200).send(getEventForRequest(req).playlists);
});

router.get('/events/:eventID/playlists/:listID', function(req, res) {
    log.trace("begin GET playlist eventId=%s, listId=%s", req.params.eventID, req.params.listID);
    uglyTrackProgressUpdater();
    res.status(200).send(getPlaylistForRequest(req));
});
router.get('/events/:eventID/playlists/:listID/currentTrack', function(req, res) {
    log.trace("begin GET playlist eventId=%s, listId=%s", req.params.eventID, req.params.listID);
    uglyTrackProgressUpdater();
    res.status(200).send(getPlaylistForRequest(req).currentTrack);
});

router.get('/events/:eventID/playlists/:listID/play', function(req, res) {
    log.trace("begin PLAY playlist eventId=%s, listId=%s", req.params.eventID, req.params.listID);
    var event = getEventForRequest(req);
    var playlist = getPlaylistForRequest(req);
    play(event, playlist);
    firePlaylistChangedEvent(event, playlist);
    res.status(200).send(playlist);
});

router.get('/events/:eventID/playlists/:listID/pause', function(req, res) {
    log.trace("begin PAUSE playlist eventId=%s, listId=%s", req.params.eventID, req.params.listID);
    var event = getEventForRequest(req);
    var playlist = getPlaylistForRequest(req);
    pause(event, playlist);
    firePlaylistChangedEvent(event, playlist);
    res.status(200).send(playlist);
});

router.get('/events/:eventID/playlists/:listID/skip', function(req, res) {
    log.trace("begin SKIP playlist eventId=%s, listId=%s", req.params.eventID, req.params.listID);
    var event = getEventForRequest(req);
    var playlist = getPlaylistForRequest(req);
    skip(event, playlist);
    firePlaylistChangedEvent(event, playlist);
    res.status(200).send(playlist);
});

app.use("/api/service-playlist/v1", router);

checkEvents();
setInterval(checkEvents, INTERNAL_POLL_INTERVAL);


app.listen(8081, function() {
    log.info('listening on port 8081!');
});