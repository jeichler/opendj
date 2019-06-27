'use strict';

const compression = require('compression');
const express = require('express');
const app = express();
var request = require('request-promise-native');
var cors = require('cors');
var kafka = require('kafka-node');
var router = new express.Router();
var log4js = require('log4js');
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
app.use(cors());
// Required for POST operations with body:
app.use(express.json());

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
var DEFAULT_PROGRESS_PERCENTAGE_REQUIRED_FOR_EFFECTIVE_PLAYLIST = parseInt(process.env.DEFAULT_PROGRESS_PERCENTAGE_REQUIRED_FOR_EFFECTIVE_PLAYLIST || '75');
var DEFAULT_ALLOW_DUPLICATE_TRACKS = (process.env.DEFAULT_ALLOW_DUPLICATE_TRACKS || 'false') == 'true';
var MOCKUP_AUTOSKIP = parseInt(process.env.MOCKUP_AUTOSKIP_SECONDS || '0') * 1000;
var MOCKUP_NO_ACTUAL_PLAYING = (process.env.MOCKUP_NO_ACTUAL_PLAYING || 'false') == 'true';
var INTERNAL_POLL_INTERVAL = parseInt(process.env.INTERNAL_POLL_INTERVAL || '100');
var PAUSE_ON_PLAYERROR = (process.env.PAUSE_ON_PLAYERROR || 'true') == 'true';


// Key: EventID: Object: Event
var mapOfEvents = new Map([
    ["0", {
        eventID: "0",
        autoFillEmptyPlaylist: DEFAULT_AUTOFILL_EMPTY_PLAYLIST,
        allowDuplicateTracks: DEFAULT_ALLOW_DUPLICATE_TRACKS,
        activePlaylist: 0,
        progressPercentageRequiredForEffectivePlaylist: DEFAULT_PROGRESS_PERCENTAGE_REQUIRED_FOR_EFFECTIVE_PLAYLIST,
        playlists: [{
            playlistID: 0,
            isPlaying: DEFAULT_IS_PLAYING,
            currentTrack: null,
            nextTracks: []
        }],
        effectivePlaylist: []
    }],
]);

var emergencyTrackIDs = [
    "spotify:4u7EnebtmKWzUH433cf5Qv", // Bohemian Rhapsody by Queen
    "spotify:4pbJqGIASGPr0ZpGpnWkDn", // We Will Rock You by Queen
    "spotify:0DfG1ltJnZyq4Tx3ZLL7ZU", // Rock me Amadeus by Falco
    "spotify:5ftamIDoDRpEvlZinDuNNW", // Flip Ya Lid by Nightmares on Wax
    "spotify:6u7jPi22kF8CTQ3rb9DHE7", // Old Town Road by Lil Nas X, Billy Ray Cyrus
    "spotify:1NaxD6BhOQ69C4Cdcx5jrP", // Coming Down by KIDDO, GASHI
    "spotify:3Wz5JAW46aCFe1BwZIePu6", // Hold On by OLSSON
    "spotify:720dTtTyYAD9TKSAd9lwrt", // Jimmy Mathis by "Bubba Sparxxx
    "spotify:72GtVxWzQSeF7xT4wr3fE0", // Shadow On The Wall by Mike Oldfield
    "spotify:3vkQ5DAB1qQMYO4Mr9zJN6", // Gimme! Gimme! Gimme!  by ABBA
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

function findTrackInList(listOfTracks, provider, trackID) {
    log.trace("begin findTrackInList");
    var result = -1;
    for (let i = 0; i < listOfTracks.length; i++) {
        var track = listOfTracks[i];
        if (track.id == trackID && track.provider == provider) {
            result = i;
            break;
        }
    }
    log.trace("end findTrackInList result=%i", result);
    return result;
}

function getETADateForTrackInPlayList(playlist, pos) {
    var ts = Date.now();
    if (playlist.currentTrack) {
        ts += (playlist.currentTrack.duration_ms - playlist.currentTrack.progress_ms);
    }
    for (var i = 0; i < pos; i++) {
        ts += playlist.nextTracks[i].duration_ms;
    }

    return new Date(ts);
}

async function addTrack(event, playlist, provider, trackID, user) {
    log.trace("begin addTrack eventID=%s, playlistID=%s, provider=%s, track=%s", event.eventID, playlist.playlistID, provider, trackID);
    if (provider != "spotify") {
        log.error("Unkown provider %s", provider);
        throw { code: "PLYLST-100", msg: "Unknown provider " + provider + "! Currently, only spotify is implemented as provider" };
    }


    log.trace("check next tracks for duplicate")
    var pos = findTrackInList(playlist.nextTracks, provider, trackID);
    if (pos >= 0) {
        log.debug("ADD rejected because in playlist at pos %s", pos);
        var eta = getETADateForTrackInPlayList(playlist, pos);
        eta = eta.toTimeString().split(' ')[0];
        eta = eta.substring(0, 5);

        throw { code: "PLYLST-110", msg: "Sorry, this track is already in the playlist at position #" + (pos + 1) + " and is expected to be played around " + eta + "!" };
    }

    if (!event.allowDuplicateTracks) {
        log.trace("duplicates not allowed, search for track in effective playlist");
        pos = findTrackInList(event.effectivePlaylist, provider, trackID);
        if (pos >= 0) {
            log.debug("ADD rejected because not duplicated allowed and track is in effective playlist");
            throw { code: "PLYLST-120", msg: "Sorry, this event does not allow duplicate tracks, and this track has already been played at " + event.effectivePlaylist[pos].started_at };
        }
    }

    // Okay, track can be added. Let's get the details
    try {
        var track = await getTrackDetailsForTrackID(event.eventID, trackID);
        if (user)
            track.added_by = user;
        else
            track.added_by = "?";

        // TODO: Insert AI/ML Code here to find the best position for this new track in the playlist
        // Until this is available, we simply added to the end:
        playlist.nextTracks.push(track);
    } catch (err) {
        log.error("getTrackDetailsForTrackID failed!", err);
        throw { code: "PLYLST-130", msg: "Could not get details for track. Err=" + JSON.stringify(err) };
    }

    log.trace("end addTrack eventID=%s, playlistID=%s, provider=%s, track=%s", event.eventID, playlist.playlistID, provider, track);
}

function moveTrack(event, playlist, provider, trackID, newPos) {
    log.trace("begin moveTrack eventID=%s, playlistID=%s, provider=%s, track=%s, newPos=%s", event.eventID, playlist.playlistID, provider, trackID, newPos);

    var currentPos = findTrackInList(playlist.nextTracks, provider, trackID);
    if (currentPos < 0) {
        throw { code: "PLYLST-200", msg: "Track not found in playlist - maybe somebody else has deleted it meanwhile?" };
    }

    // Sanity check of new pos:
    var len = playlist.nextTracks.length;
    if (newPos < 0) newPos = 0;
    if (newPos >= len) newPos = len - 1;

    // Remove at current pos:
    var track = playlist.nextTracks.splice(currentPos, 1)[0];

    // Insert at new pos;
    playlist.nextTracks.splice(newPos, 0, track);


    log.trace("end moveTrack eventID=%s, playlistID=%s, provider=%s, track=%s", event.eventID, playlist.playlistID, provider, track);
}

function deleteTrack(event, playlist, provider, trackID) {
    log.trace("begin moveTrack eventID=%s, playlistID=%s, provider=%s, track=%s", event.eventID, playlist.playlistID, provider, trackID);

    var currentPos = findTrackInList(playlist.nextTracks, provider, trackID);
    if (currentPos < 0) {
        throw { code: "PLYLST-200", msg: "Track not found in playlist - maybe somebody else has deleted it meanwhile?" };
    }

    // Remove at current pos:
    playlist.nextTracks.splice(currentPos, 1);


    log.trace("end moveTrack eventID=%s, playlistID=%s, provider=%s, track=%s", event.eventID, playlist.playlistID, provider, track);
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

async function play(event, playlist) {
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

    // Fire and Forget  Call Spotify-Provider to play at currentTrack.progress_ms
    // TODO: Make this truly async, i.e. sent a message, and provider fires a "PLAY_STARTED" event when action succeded
    if (MOCKUP_NO_ACTUAL_PLAYING) {
        log.error("ATTENTION: MOCKUP_NO_ACTUAL_PLAYING is active - play request is NOT actually being executed");
    } else {
        log.debug("Play it, Sam. Play %s", playlist.currentTrack.id);
        try {
            await request(SPOTIFY_PROVIDER_URL + "play?event=" + event.eventID + "&track=" + playlist.currentTrack.id + "&pos=" + playlist.currentTrack.progress_ms, { json: true });
        } catch (err) {
            log.fatal("!!! PLAY FAILED err=" + err);
            if (PAUSE_ON_PLAYERROR) {
                log.debug("Pressing pause to avoid damage after play failed!");
                pause(event, playlist, err);
            }
            throw { code: "PLYLST-300", msg: "Could not play track. Err=" + err };
        }
    }

    log.info("PLAY event=%s, playlist=%s, track=%s, startAt=%s", event.eventID, playlist.playlistID, playlist.currentTrack.id, playlist.currentTrack.progress_ms);

    log.trace("play end event=%s, playlist=%s", event.eventID, playlist.playlistID);
}

function pause(event, playlist, err) {
    log.info("PAUSE event=%s, playlist=%s", event.eventID, playlist.playlistID);
    // Make sure we take note of the current progress:
    updateCurrentTrackProgress(playlist);
    playlist.isPlaying = false;

    if (err) {
        log.debug("pause called due to error - do NOT call spotify");
    } else {
        log.fatal("need to call Spotify-Provider to stop playback here ");
    }
}


async function skip(event, playlist) {
    log.trace("skip begin");
    log.info("SKIP event=%s, playlist=%s", event.eventID, playlist.playlistID);

    if (playlist.isPlaying && playlist.currentTrack) {
        log.trace("skipping current track");
        var progressPercentage = Math.round((playlist.currentTrack.progress_ms / playlist.currentTrack.duration_ms) * 100);
        if (progressPercentage >= event.progressPercentageRequiredForEffectivePlaylist) {
            log.debug("adding current track to effectivePlaylist")
            event.effectivePlaylist.push(playlist.currentTrack);
        } else {
            log.debug("Track was skipped at %s\%, which is below required %s\% for effective playlist, so NOT adding it",
                progressPercentage, event.progressPercentageRequiredForEffectivePlaylist);
        }
    }

    playlist.currentTrack = playlist.nextTracks.shift();
    if (playlist.currentTrack) {
        playlist.currentTrack.progress_ms = 0;
        if (playlist.isPlaying) {
            await play(event, playlist);
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
            log.info("AutoFilling Playlist %s of event %s....", playlist.playlistID, event.eventID);
            playlist.nextTracks = await createAutofillPlayList(event.eventID);
            stateChanged = true;
            log.debug("AutoFilling Playlist %s of event %s....DONE", playlist.playlistID, event.eventID);
        }
    } else {
        log.trace("playlist has tracks");
    }

    if (playlist.isPlaying && !isTrackPlaying(playlist)) {
        await skip(event, playlist);
        stateChanged = true;
    }

    if (stateChanged)
        firePlaylistChangedEvent(event, playlist);

    log.trace("checkPlaylist end stateChanged=%s", stateChanged);
    return stateChanged;
}

function checkEvent(event) {
    log.trace("checkEvent begin");

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
        checkPlaylist(event, playlist)
            .catch(err => log.error("check playlist failed err=" + JSON.stringify(err)))
    }
    log.trace("checkEvent end");
}

function checkEvents() {
    log.trace("checkEvents begin");
    mapOfEvents.forEach(checkEvent);
    log.trace("checkEvents end");
}

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

// ------------------------------------  Routes ---------------------

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
    log.trace("begin GET currentTrack eventId=%s, listId=%s", req.params.eventID, req.params.listID);
    uglyTrackProgressUpdater();
    res.status(200).send(getPlaylistForRequest(req).currentTrack);
});
router.get('/events/:eventID/playlists/:listID/tracks', function(req, res) {
    log.trace("begin GET tracks eventId=%s, listId=%s", req.params.eventID, req.params.listID);
    uglyTrackProgressUpdater();
    res.status(200).send(getPlaylistForRequest(req).nextTracks);
});


router.get('/events/:eventID/playlists/:listID/play', function(req, res) {
    log.trace("begin PLAY tracks eventId=%s, listId=%s", req.params.eventID, req.params.listID);

    var event = getEventForRequest(req);
    var playlist = getPlaylistForRequest(req);
    play(event, playlist)
        .then(function() {
            firePlaylistChangedEvent(event, playlist);
            res.status(200).send(playlist);
        }).catch(function(err) {
            log.debug("play failed with err", err);
            res.status(500).send(err);
        });
});


router.get('/events/:eventID/playlists/:listID/pause', function(req, res) {
    log.trace("begin PAUSE playlist eventId=%s, listId=%s", req.params.eventID, req.params.listID);
    var event = getEventForRequest(req);
    var playlist = getPlaylistForRequest(req);
    pause(event, playlist);
    firePlaylistChangedEvent(event, playlist);
    res.status(200).send(playlist);
});

router.get('/events/:eventID/playlists/:listID/next', function(req, res) {
    log.trace("begin SKIP playlist eventId=%s, listId=%s", req.params.eventID, req.params.listID);
    var event = getEventForRequest(req);
    var playlist = getPlaylistForRequest(req);
    skip(event, playlist);
    firePlaylistChangedEvent(event, playlist);
    res.status(200).send(playlist);
});

// Add Track:
router.post('/events/:eventID/playlists/:listID/tracks', async function(req, res) {
    log.trace("begin ADD track playlist eventId=%s, listId=%s", req.params.eventID, req.params.listID);
    log.trace("body=%s", JSON.stringify(req.body));

    var event = getEventForRequest(req);
    var playlist = getPlaylistForRequest(req);
    var provider = req.body.provider;
    var trackID = req.body.id;
    var user = req.body.user;

    try {
        await addTrack(event, playlist, provider, trackID, user);
        firePlaylistChangedEvent(event, playlist);
        res.status(200).send(playlist);
        log.info("Track ADDED eventId=%s, listId=%s, track=%s:%s", req.params.eventID, req.params.listID, provider, trackID);
    } catch (error) {
        log.debug(error);
        // Probably a duplicate or track not found problem:
        // 406: Not Acceptable
        res.status(406).send(JSON.stringify(error));
    }
});

// Reorder // move Track:
router.post('/events/:eventID/playlists/:listID/reorder', function(req, res) {
    log.trace("begin MOVE track playlist eventId=%s, listId=%s", req.params.eventID, req.params.listID);
    log.trace("body=%s", JSON.stringify(req.body));

    try {
        var event = getEventForRequest(req);
        var playlist = getPlaylistForRequest(req);
        var provider = req.body.provider;
        var trackID = req.body.id;
        var to = parseInt(req.body.to);


        moveTrack(event, playlist, provider, trackID, to);
        firePlaylistChangedEvent(event, playlist);
        res.status(200).send(playlist);
        log.info("Track MOVED eventId=%s, listId=%s, track=%s:%s, to=%s", req.params.eventID, req.params.listID, provider, trackID, to);
    } catch (error) {
        log.debug(error);
        // Probably a track not found problem:
        // 406: Not Acceptable
        res.status(406).send(JSON.stringify(error));
    }
});

// DELETE Track:
// return this.http.delete(this.PLAYLIST_PROVIDER_API + '/events/0/playlists/0/tracks/' + encodeURIComponent(`spotify:${trackId}`) + '?index=' + encodeURIComponent('' + index));
router.delete('/events/:eventID/playlists/:listID/tracks/:track', function(req, res) {
    log.trace("begin DELETE track playlist eventId=%s, listId=%s", req.params.eventID, req.params.listID);
    log.trace("body=%s", JSON.stringify(req.body));

    try {
        var event = getEventForRequest(req);
        var playlist = getPlaylistForRequest(req);

        // Track is in format <provider>:<trackID>, thus we need to split:
        var parts = req.params.track.split(':');
        var provider = parts[0];
        var trackID = parts[1];

        deleteTrack(event, playlist, provider, trackID);

        firePlaylistChangedEvent(event, playlist);
        res.status(200).send(playlist);
        log.info("Track DELETED eventId=%s, listId=%s, track=%s:%s", req.params.eventID, req.params.listID, provider, trackID);
    } catch (error) {
        log.debug(error);
        // Probably a track not found problem:
        // 406: Not Acceptable
        res.status(406).send(JSON.stringify(error));
    }
});


app.use("/api/service-playlist/v1", router);

if (INTERNAL_POLL_INTERVAL > 5000)
    checkEvents();
setInterval(checkEvents, INTERNAL_POLL_INTERVAL);

app.listen(8081, function() {
    log.info('listening on port 8081!');
});