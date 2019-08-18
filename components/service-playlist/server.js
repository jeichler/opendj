'use strict';

const compression = require('compression');
const express = require('express');
const app = express();
var request = require('request-promise-native');
var cors = require('cors');
var router = new express.Router();
var log4js = require('log4js');
var log = log4js.getLogger();
log.level = process.env.LOG_LEVEL || "trace";

var COMPRESS_RESULT = process.env.COMPRESS_RESULT || "true";
var readyState = {
    datagridClient: false,
    lastError: ""
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
        "msg": err,
        "code": "PLYLST-42"
    };
    response.writeHead(500);
    response.end(JSON.stringify(error));
}



// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// ------------------------------ playlist stuff ----------------------------
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------

const PORT = process.env.PORT || 8090;

// Interval we check for expired tokens:
const SPOTIFY_PROVIDER_URL = process.env.SPOTIFY_PROVIDER_URL || "http://localhost:8081/api/provider-spotify/v1/";

// Defaults:
const DEFAULT_TEST_EVENT_CREATE = (process.env.DEFAULT_TEST_EVENT_CREATE || 'true') == 'true';
const DEFAULT_TEST_EVENT_ID = (process.env.DEFAULT_TEST_EVENT_ID || '0');
const DEFAULT_AUTOFILL_EMPTY_PLAYLIST = (process.env.DEFAULT_AUTOFILL_EMPTY_PLAYLIST || 'true') == 'true';
const DEFAULT_IS_PLAYING = (process.env.DEFAULT_IS_PLAYING || 'true') == 'true';
const DEFAULT_PROGRESS_PERCENTAGE_REQUIRED_FOR_EFFECTIVE_PLAYLIST = parseInt(process.env.DEFAULT_PROGRESS_PERCENTAGE_REQUIRED_FOR_EFFECTIVE_PLAYLIST || '75');
const DEFAULT_ALLOW_DUPLICATE_TRACKS = (process.env.DEFAULT_ALLOW_DUPLICATE_TRACKS || 'false') == 'true';
const MOCKUP_AUTOSKIP = parseInt(process.env.MOCKUP_AUTOSKIP_SECONDS || '0');
const MOCKUP_NO_ACTUAL_PLAYING = (process.env.MOCKUP_NO_ACTUAL_PLAYING || 'false') == 'true';
const INTERNAL_POLL_INTERVAL = parseInt(process.env.INTERNAL_POLL_INTERVAL || '10000');
const PAUSE_ON_PLAYERROR = (process.env.PAUSE_ON_PLAYERROR || 'true') == 'true';

const EVENT_PROTOTYPE = {
    eventID: "",
    url: "",
    name: "",
    owner: "",
    passwordOwner: "owner",
    passwordCurator: "opendj",
    passwordUser: "",
    maxUsers: 100,
    maxDurationInMinutes: 3600,
    maxTracksInPlaylist: 100,
    eventStartsAt: "",
    eventEndsAt: "",
    allowDuplicateTracks: DEFAULT_ALLOW_DUPLICATE_TRACKS,
    progressPercentageRequiredForEffectivePlaylist: DEFAULT_PROGRESS_PERCENTAGE_REQUIRED_FOR_EFFECTIVE_PLAYLIST,
    beginPlaybackAtEventStart: false,
    everybodyIsCurator: false,
    pauseOnPlayError: true,
    enableTrackLiking: true,
    enableTrackHating: true,
    demoAutoskip: MOCKUP_AUTOSKIP,
    demoNoActualPlaying: MOCKUP_NO_ACTUAL_PLAYING,
    demoAutoFillEmptyPlaylist: DEFAULT_AUTOFILL_EMPTY_PLAYLIST,
    providers: ["spotify"],

    activePlaylist: 0,
    playlists: [0],
    effectivePlaylist: []
}

// Key: EventID: Object: Timer
var mapOfTimers = new Map();

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

function createEmptyEvent() {
    log.trace("begin createEmptyEvent");
    let event = JSON.parse(JSON.stringify(EVENT_PROTOTYPE));
    let now = new Date();

    event.eventStartsAt = now.toISOString();
    event.eventEndsAt = now.toISOString();
    //    event.eventEndsAt = new Date(now.value + event.maxDurationInMinutes * 60 * 1000).toISOString();

    log.trace("end createEmptyEvent");
    return event;

}

function createEmptyPlaylist(eventID, playlistID) {
    log.trace("begin createEmptyPlaylist eventID=%s, playlistID=%s", eventID, playlistID);
    return {
        eventID: eventID,
        playlistID: playlistID,
        currentTrack: null,
        nextTracks: [],
        isPlaying: DEFAULT_IS_PLAYING
    };
}

function splitTrackIDIntoProviderAndTrack(id) {
    let splitter = id.split(":");
    let provider = splitter[0];
    let trackID = splitter[1];
    return [provider, trackID];
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

async function getActivePlaylistForEvent(event) {
    log.trace("begin getActivePlaylistForEvent");
    let playlist = await getPlaylistWithID(event.eventID, event.activePlaylist);
    log.trace("end getActivePlaylistForEvent");
    return playlist;
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


async function getTrackDetailsForTrackID(eventID, trackID) {

    log.trace("begin getTrackDetailsForTrackID eventID=%s, trackID=%s", eventID, trackID);
    let [provider, track] = splitTrackIDIntoProviderAndTrack(trackID);
    let url = SPOTIFY_PROVIDER_URL + "events/" + eventID + "/providers/" + provider + "/tracks/" + track;
    log.debug("getTrackDetailsForTrackID before request url=>%s<", url);
    let result = await request(url, { json: true })

    if (log.isTraceEnabled())
        log.trace("end getTrackDetailsForTrackID eventID=%s, trackID=%s, result=$s", eventID, trackID, JSON.stringify(result));
    return result;
}

async function createAutofillPlayList(eventID) {
    log.trace("createAutofillPlayList begin eventID=%s", eventID);
    var result = [];
    log.info("AUTOFILL event=%s", eventID);

    for (let trackID of emergencyTrackIDs) {
        let track = await getTrackDetailsForTrackID(eventID, trackID);
        track.added_by = "OpenDJ";
        result.push(track);
    }
    log.trace("createAutofillPlayList end eventID=%s len=%s", eventID, result.length);
    return result;
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
        let track = await getTrackDetailsForTrackID(event.eventID, trackID);
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

    if (playlist.currentTrack == null && playlist.isPlaying == true) {
        log.debug("Adding while currentTrack is null - the list seems to be empty, so we skip to make it the current track");
        try {
            await skip(event, playlist);
        } catch (err) {
            log.warn("skip failed when current track was null during add. ignoring err=" + err);
        }
    }

    log.trace("end addTrack eventID=%s, playlistID=%s, provider=%s, track=%s", event.eventID, playlist.playlistID, provider, track);
}

function moveTrack(eventID, playlist, provider, trackID, newPos) {
    log.trace("begin moveTrack eventID=%s, playlistID=%s, provider=%s, track=%s, newPos=%s", eventID, playlist.playlistID, provider, trackID, newPos);

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

    log.trace("end moveTrack eventID=%s, playlistID=%s, provider=%s, track=%s", eventID, playlist.playlistID, provider, track);
}

function deleteTrack(eventID, playlist, provider, trackID) {
    log.trace("begin deleteTrack eventID=%s, playlistID=%s, provider=%s, track=%s", eventID, playlist.playlistID, provider, trackID);

    let currentPos = findTrackInList(playlist.nextTracks, provider, trackID);
    if (currentPos < 0) {
        throw { code: "PLYLST-200", msg: "Track not found in playlist - maybe somebody else has deleted it meanwhile?" };
    }

    // Remove at current pos:
    playlist.nextTracks.splice(currentPos, 1);


    log.trace("end deleteTrack eventID=%s, playlistID=%s, provider=%s, track=%s", eventID, playlist.playlistID, provider, trackID);
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

function clearTimerForEvent(eventID) {
    log.trace("begin clearTimerForEvent %s", eventID);
    let timer = mapOfTimers.get(eventID);
    if (timer) {
        log.debug("cleared timer for event %s", eventID);
        clearTimeout(timer);
        mapOfTimers.delete(eventID);
    } else {
        log.debug("no timer for event %s - clear ignored", eventID);
    }
    log.trace("end clearTimerForEvent %s", eventID);
}


async function timerExpiredForEvent(eventID) {
    log.debug("begin timer expired for eventID=%s - check event", eventID);
    try {
        let event = await getEventForEventID(eventID);
        await checkEvent(event);
    } catch (err) {
        log.warn("timerExpiredForEvent failed with excpetion - will retry in a second", err);
        setTimeout(timerExpiredForEvent, 1000, eventID);
    }
    log.debug("end timer expired for eventID=%s - check event", eventID);

}

function setTimerForEvent(event, playlist) {
    log.trace("begin setTimerForEvent %s", event.eventID);

    let timeout = playlist.currentTrack.duration_ms - playlist.currentTrack.progress_ms;
    if (event.demoAutoskip > 0 && timeout > event.demoAutoskip * 1000) {
        timeout = event.demoAutoskip * 1000;
    }

    if (timeout < 0 || timeout > 10 * 60 * 1000) {
        log.warn("Calculated strange timeout %s for event %s - adjusting to 5 sec, hoping that the situation will resolve", timeout, event.eventID);
        timeout = 5000;
    }

    clearTimerForEvent(event.eventID);
    log.debug("Set timer for event %s with timeout %s", event.eventID, timeout);
    let timer = setTimeout(timerExpiredForEvent, timeout, event.eventID);

    mapOfTimers.set(event.eventID, timer);

    log.trace("end setTimerForEvent %s", event.eventID);
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

        // DUE TO A BUG IN SPOTIY PROVIDER WE CANT RESUME  
        // Play will actually start at the beginning.
        // WORKAROUND:
        playlist.currentTrack.progress_ms = 0;
        now = Date.now();
    }
    playlist.currentTrack.started_at = new Date(now).toISOString();

    updateCurrentTrackProgress(playlist);

    // Fire and Forget  Call Spotify-Provider to play at currentTrack.progress_ms
    // TODO: Make this truly async, i.e. sent a message, and provider fires a "PLAY_STARTED" event when action succeded
    if (event.demoNoActualPlaying) {
        log.info("Demo No Actual Playing is active for event %s - play request is NOT actually being executed", event.eventID);
    } else {
        log.debug("Play it, Sam. Play %s", playlist.currentTrack.id);
        try {
            await request(
                SPOTIFY_PROVIDER_URL +
                "events/" + event.eventID +
                "/providers/" + playlist.currentTrack.provider +
                "/play/" + playlist.currentTrack.id +
                "?pos=" + playlist.currentTrack.progress_ms, { json: true });
        } catch (err) {
            log.fatal("!!! PLAY FAILED err=" + err);
            if (PAUSE_ON_PLAYERROR) {
                log.debug("Pressing pause to avoid damage after play failed!");
                await pause(event, playlist, err);
            }
            throw { code: "PLYLST-300", msg: "Could not play track. Err=" + err };
        }
    }

    // Start playing was successful!
    log.info("PLAY event=%s, playlist=%s, track=%s, startAt=%s, name=%s", event.eventID, playlist.playlistID, playlist.currentTrack.id, playlist.currentTrack.progress_ms, playlist.currentTrack.name);
    setTimerForEvent(event, playlist);

    log.trace("play end event=%s, playlist=%s", event.eventID, playlist.playlistID);
}

async function pause(event, playlist, err) {
    log.info("PAUSE event=%s, playlist=%s", event.eventID, playlist.playlistID);
    // Make sure we take note of the current progress:
    updateCurrentTrackProgress(playlist);
    playlist.isPlaying = false;
    clearTimerForEvent(event.eventID);


    if (event.demoNoActualPlaying) {
        log.info("Demo No Actual Playing is active for event %s - pause request is NOT actually being executed", event.eventID);
    } else if (err) {
        log.debug("pause called due to error - do NOT call spotify");
    } else {
        try {
            log.debug("calling provider " + playlist.currentTrack.provider);
            await request(SPOTIFY_PROVIDER_URL + "events/" + event.eventID + "/providers/" + playlist.currentTrack.provider + "/pause");
        } catch (err) {
            log.warn("pause failed while calling spotify. This error is ignored: " + err);
            // throw { code: "PLYLST-400", msg: "Could not pause track. Err=" + err };
        }
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
        log.debug("SKIP to next track");
        playlist.currentTrack.progress_ms = 0;
        if (playlist.isPlaying) {
            await play(event, playlist);
        }
    } else {
        log.info("SKIP: reached end of playlist");
        playlist.currentTrack = null;
        clearTimerForEvent(event.eventID);

        log.trace("Check for autofill");
        let stateChanged = await autofillPlaylistIfNecessary(event, playlist);
        if (stateChanged && playlist.isPlaying) {
            if (playlist.isPlaying) {
                log.trace("playlist auto filled - pressing play again");
                await play(event, playlist);
            } else {
                log.trace("playlist auto filled but not playing");
            }
        } else {
            log.trace("This is really the end - stop the music");
            try {
                if (MOCKUP_NO_ACTUAL_PLAYING) {
                    log.error("ATTENTION: MOCKUP_NO_ACTUAL_PLAYING is active - pause request at end of playlist is NOT actually being executed");
                } else {
                    log.debug("calling provider %s to pause", playlist.currentTrack.provider);
                    let result = await request(SPOTIFY_PROVIDER_URL + "events/" + event.eventID + "/providers/" + playlist.currentTrack.provider + "/pause");
                    log.debug("pause provider %s result=%s", playlist.currentTrack.provider, result);

                }
            } catch (err) {
                log.warn("call to spotify pause at end of playlist failed - ignoring err=" + err);
            };
        }
    }
    log.trace("skip end");
}

function isTrackPlaying(event, playlist) {
    var result = false;
    log.trace("isTrackPlaying begin id=%s", playlist.playlistID);

    if (playlist.isPlaying) {
        if (playlist.currentTrack) {
            log.trace("   current track is present");
            updateCurrentTrackProgress(playlist);
            var currentPos = playlist.currentTrack.progress_ms;

            if (currentPos > 0) {
                log.trace("   currentPos=%s s", currentPos / 1000);
                if (currentPos >= playlist.currentTrack.duration_ms - 10) {
                    log.trace("   currentPos after duration");
                    result = false;
                } else if (currentPos < 0) {
                    log.error("isTrackPlaying: currentPos is negative????");
                    result = false;
                } else {
                    log.trace("   currentPos is within duration");
                    if (event.demoAutoskip > 0 && currentPos >= event.demoAutoskip * 1000 - 10) {
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

async function autofillPlaylistIfNecessary(event, playlist) {
    log.trace("begin autofillPlaylistIfNecessary");
    let stateChanged = false;
    if (playlist.nextTracks.length == 0) {
        log.trace("playlist is empty");
        if (event.demoAutoFillEmptyPlaylist) {
            log.info("AutoFilling Playlist %s of event %s....", playlist.playlistID, event.eventID);
            playlist.nextTracks = await createAutofillPlayList(event.eventID);
            stateChanged = true;
            log.debug("AutoFilling Playlist %s of event %s....DONE", playlist.playlistID, event.eventID);
        }
    } else {
        log.trace("playlist has tracks");
    }

    log.trace("end autofillPlaylistIfNecessary stateChanged=%s", stateChanged);
    return stateChanged;
}

async function checkPlaylist(event, playlist) {
    log.trace("checkPlaylist begin");
    let stateChanged = await autofillPlaylistIfNecessary(event, playlist);

    if (playlist.isPlaying && !isTrackPlaying(event, playlist)) {
        log.trace("playlist is playing but no track is playing - skipping to next track");
        await skip(event, playlist);
        stateChanged = true;
    } else {
        log.trace("playlist is not playing, or track is playing - nothing to do for us");
    }

    if (stateChanged) {
        log.trace("State changed");
        firePlaylistChangedEvent(event.eventID, playlist);
    }

    log.trace("checkPlaylist end stateChanged=%s", stateChanged);
    return stateChanged;
}

async function checkEvent(event) {
    log.trace("begin checkEvent for id %s", event.eventID);
    try {
        for (let playlistID of event.playlists) {
            log.trace("get playlist");
            let playlist = await getPlaylistWithID(event.eventID, playlistID);
            if (!playlist) {
                log.trace("playlist is not defined");
                playlist = createEmptyPlaylist(event.eventID, playlistID);
            }
            log.trace("check playlist");
            await checkPlaylist(event, playlist)
        }
    } catch (err) {
        log.error("checkEvent %s failed with err %s - ignored", event.eventID, err);
    }
    log.trace("end checkEvent for id %s", event.eventID);
}

async function checkEvents() {
    log.trace("checkEvents begin");
    try {
        let it = await gridEvents.iterator(10);
        let entry = await it.next();

        while (!entry.done) {
            log.trace("checkEvents grid iterator key=%s", entry.key);
            if ("-1" == entry.key) {
                log.trace("ignoring key -1 used for clever event checking");
            } else {
                let event = JSON.parse(entry.value);
                if (event.playlists) {
                    // TODO: Make this a REST call to utilized load balancing
                    await checkEvent(event);
                } else {
                    log.debug("ignoring strange event from grid with key %s", entry.key);
                    //                if (log.isTraceEnabled()) log.trace("entry=%s", JSON.stringify(entry));
                }
            }

            log.trace("Get next entry from cache iterator");
            entry = await it.next();
        }

        await it.close();

    } catch (err) {
        log.error("checkEvents failed with err %s", err);
    }

    log.trace("checkEvents end");
}

async function getEventForEventID(eventID) {
    log.trace("begin getEventForEventID id=%s", eventID);
    let event = null;
    if ("___prototype___" == eventID) {
        log.debug("getEventForEventID prototype requested");
        event = createEmptyEvent();
    } else {
        event = await getFromGrid(gridEvents, eventID);
        if (event == null) {
            log.debug("getEventForEventID event is null for id=%s", eventID);
        } else {
            if (log.isTraceEnabled())
                log.trace("event from grid = %s", JSON.stringify(event));
        }
        log.trace("end getEventForEventID id=%s", eventID);
    }

    return event;
}

async function getEventForRequest(req) {
    log.trace("begin getEventForRequest");
    let event = await getEventForEventID(req.params.eventID);
    log.trace("end getEventForRequest");
    return event;
}

async function getPlaylistWithID(eventID, playlistID) {
    log.trace("begin getPlaylistWithID %s:%s", eventID, playlistID);
    let playlist = await getFromGrid(gridPlaylists, eventID + ":" + playlistID);
    log.trace("end getPlaylistWithID");
    return playlist;
}


async function getPlaylistForRequest(req) {
    log.trace("begin getPlaylistForRequest");
    let eventID = req.params.eventID;
    let listID = req.params.listID;
    let playlist = await getPlaylistWithID(eventID, listID);
    log.trace("end getPlaylistForRequest");
    return playlist;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// ---------------------------     Event CRUD   ------------------------------
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
async function createEvent(event) {
    log.trace("begin createEvent");
    event = await validateEvent(event, true);
    fireEventChangedEvent(event);
    log.trace("end createEvent");
}
async function updateEvent(event) {
    log.trace("begin updateEvent");
    event = await validateEvent(event, false);
    fireEventChangedEvent(event);
    log.trace("end updateEvent");
}

async function deleteEvent(eventID) {
    log.trace("begin deleteEvent id=%s", eventID);

    let event = await getEventForEventID(eventID);
    if (event) {
        log.debug("deleteEvent %s - found in grid", eventID);

        // TODO: Do we want to stop the current track, if playing?

        if (event.playlists && event.playlists.length > 0) {
            log.debug("Removing playlist for event %s", eventID);
            for (let playlist of event.playlists) {
                log.debug("Remove playlist %s from grid", playlist.playlistID);
                await removeFromGrid(gridPlaylists, event.eventID + ":" + playlist.playlistID);
            };
        } else {
            log.trace("no playlists to delete");
        }
        log.debug("Remove event %s from grid", event.eventID);
        await removeFromGrid(gridEvents, event.eventID);
        log.info("EVENT DELETED %s", eventID);
    } else {
        log.warn("deleteEvent ignored because event with id %s not found", eventID);
    }

    log.trace("end deleteEvent");
}


async function validateEvent(event, isCreate) {
    log.trace("begin validateEvent isCreate=%s", isCreate);
    let listOfValidationErrors = new Array();

    if (isCreate) {
        // check if ID is existing:
        let otherEvent = await getEventForEventID(event.eventID);
        if (otherEvent) {
            listOfValidationErrors.push({ code: "EVENT-100", msg: "An Event with this ID already exists", att: "eventID" });
        }
    }

    // Adjust URL:
    event.url = "www.opendj.io/" + event.eventID;

    if (listOfValidationErrors.length > 0) {
        log.trace("Throwing validationErrors");
        throw listOfValidationErrors;
    }

    log.trace("end validateEvent");
    return event;
}



// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// ---------------------------  Routes - Event  ------------------------------
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

// create
router.post('/events', async function(req, res) {
    log.trace("begin route createEvent");

    try {
        if (log.isTraceEnabled()) log.trace("route createEvent body=%s", JSON.stringify(req.body));
        let event = req.body;
        await createEvent(event);
        res.status(200).send(event);
        log.info("Event CREATED eventId=%s, URL=%s", event.eventID, event.url);
    } catch (error) {
        log.error("route create Event err = %s", error);
        res.status(500).send(JSON.stringify(error));
    }
    log.trace("end route createEvent");
});

// read:
router.get('/events/:eventID', async function(req, res) {
    log.trace("begin GET event eventId=%s", req.params.eventID);
    getEventForRequest(req)
        .then(function(event) { res.status(200).send(event); })
        .catch(function(err) { handleError(err, res) });
});

// update
router.post('/events/:eventID', async function(req, res) {
    log.trace("begin route updateEvent");

    try {
        if (log.isTraceEnabled()) log.trace("route updateEvent body=%s", JSON.stringify(req.body));
        let event = req.body;
        await updateEvent(event);
        res.status(200).send(event);
        log.debug("Event UPDATED eventId=%s, URL=%s", event.eventID, event.url);
    } catch (error) {
        log.error("route update Event err = %s", error);
        res.status(500).send(JSON.stringify(error));
    }
    log.trace("end route updateEvent");
});

// delete
router.delete('/events/:eventID', async function(req, res) {
    log.trace("begin route deleteEvent eventId=%s", req.params.eventID);

    try {
        await deleteEvent(req.params.eventID);
        let event = createEmptyEvent();
        res.status(200).send(event);
        log.debug("Event DELETE eventId=%s", req.params.eventID);
    } catch (error) {
        log.error("route delete Event err = %s", error);
        res.status(500).send(JSON.stringify(error));
    }
    log.trace("begin route deleteEvent eventId=%s", req.params.eventID);
});

// validate
router.post('/events/:eventID/validate', async function(req, res) {
    log.trace("begin route validateEvent");

    try {
        if (log.isTraceEnabled()) log.trace("route validateEvent body=%s", JSON.stringify(req.body));
        let event = req.body;

        event = await validateEvent(event, true);
        res.status(200).send(event);

    } catch (error) {
        log.debug("route validate Event err = %s", error);
        res.status(500).send(JSON.stringify(error));
    }
    log.trace("end route validateEvent");
});




// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// -------------------------  Routes - Playlist  -----------------------------
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------


router.get('/events/:eventID/playlists/:listID', async function(req, res) {
    log.trace("begin GET playlist eventId=%s, listId=%s", req.params.eventID, req.params.listID);
    let playlist = await getPlaylistForRequest(req);
    updateCurrentTrackProgress(playlist);
    res.status(200).send(playlist);
});

router.get('/events/:eventID/playlists/:listID/currentTrack', async function(req, res) {
    log.trace("begin GET currentTrack eventId=%s, listId=%s", req.params.eventID, req.params.listID);
    let playlist = await getPlaylistForRequest(req);
    updateCurrentTrackProgress(playlist);
    res.status(200).send(playlist.currentTrack);
});

router.get('/events/:eventID/playlists/:listID/tracks', async function(req, res) {
    log.trace("begin GET tracks eventId=%s, listId=%s", req.params.eventID, req.params.listID);
    let playlist = await getPlaylistForRequest(req);
    updateCurrentTrackProgress(playlist);
    res.status(200).send(playlist.nextTracks);
});


router.get('/events/:eventID/playlists/:listID/play', async function(req, res) {
    log.trace("begin PLAY tracks eventId=%s, listId=%s", req.params.eventID, req.params.listID);

    var event = await getEventForRequest(req);
    var playlist = await getPlaylistForRequest(req);
    play(event, playlist)
        .then(function() {
            firePlaylistChangedEvent(event.eventID, playlist);
            res.status(200).send(playlist);
        }).catch(function(err) {
            log.debug("play failed with err", err);
            res.status(500).send(err);
        });
});


router.get('/events/:eventID/playlists/:listID/pause', async function(req, res) {
    log.trace("begin PAUSE playlist eventId=%s, listId=%s", req.params.eventID, req.params.listID);
    var event = await getEventForRequest(req);
    var playlist = await getPlaylistForRequest(req);
    pause(event, playlist).then(function() {
        firePlaylistChangedEvent(event.eventID, playlist);
        res.status(200).send(playlist);
    }).catch(function(err) {
        log.debug("pause failed with err", err);
        res.status(500).send(err);
    });

});

router.get('/events/:eventID/playlists/:listID/next', async function(req, res) {
    log.trace("begin NEXT playlist eventId=%s, listId=%s", req.params.eventID, req.params.listID);
    var event = await getEventForRequest(req);
    var playlist = await getPlaylistForRequest(req);
    skip(event, playlist).then(function() {
        firePlaylistChangedEvent(event.eventID, playlist);
        res.status(200).send(playlist);
    }).catch(function(err) {
        log.debug("pause failed with err", err);
        res.status(500).send(err);
    });
});



router.get('/events/:eventID/playlists/:listID/push', async function(req, res) {
    log.trace("begin SKIP playlist eventId=%s, listId=%s", req.params.eventID, req.params.listID);
    var playlist = await getPlaylistForRequest(req);
    firePlaylistChangedEvent(req.params.eventID, playlist);
    res.status(200).send(playlist);
});

// Add Track:
router.post('/events/:eventID/playlists/:listID/tracks', async function(req, res) {
    log.trace("begin ADD track playlist eventId=%s, listId=%s", req.params.eventID, req.params.listID);
    log.trace("body=%s", JSON.stringify(req.body));

    let event = await getEventForRequest(req);
    let playlist = getPlaylistForRequest(req);
    let provider = req.body.provider;
    let trackID = req.body.id;
    let user = req.body.user;

    try {
        await addTrack(event, playlist, provider, trackID, user);
        firePlaylistChangedEvent(event.eventID, playlist);
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
router.post('/events/:eventID/playlists/:listID/reorder', async function(req, res) {
    log.trace("begin MOVE track playlist eventId=%s, listId=%s", req.params.eventID, req.params.listID);
    log.trace("body=%s", JSON.stringify(req.body));

    try {
        let playlist = await getPlaylistForRequest(req);
        let provider = req.body.provider;
        let trackID = req.body.id;
        let to = parseInt(req.body.to);

        moveTrack(req.params.eventID, playlist, provider, trackID, to);
        firePlaylistChangedEvent(req.params.eventID, playlist);
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
router.delete('/events/:eventID/playlists/:listID/tracks/:track', async function(req, res) {
    log.trace("begin DELETE track playlist eventId=%s, listId=%s", req.params.eventID, req.params.listID);
    log.trace("body=%s", JSON.stringify(req.body));

    try {
        let playlist = await getPlaylistForRequest(req);

        // Track is in format <provider>:<trackID>, thus we need to split:
        let [provider, trackID] = splitTrackIDIntoProviderAndTrack(req.params.track);;

        deleteTrack(req.params.eventID, playlist, provider, trackID);

        firePlaylistChangedEvent(req.params.eventID, playlist);
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




// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// ------------------------------ datagrid stuff -----------------------------
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
const DATAGRID_URL = process.env.DATAGRID_URL || "localhost:11222"
const datagrid = require('infinispan');
var gridPlaylists = null;
var gridEvents = null;
async function connectToGrid(name) {
    let grid = null;
    try {
        log.debug("begin connectToGrid %s", name);
        let splitter = DATAGRID_URL.split(":");
        let host = splitter[0];
        let port = splitter[1];
        grid = await datagrid.client([{ host: host, port: port }], { gridName: name, mediaType: 'application/json' });
        readyState.datagridClient = true;
        log.info("connected to grid %s", name);
    } catch (err) {
        readyState.datagridClient = false;
        readyState.lastError = err;
        throw "DataGrid connection FAILED with err " + err;
    }

    return grid;
}

async function getFromGrid(grid, key) {
    try {
        let val = await grid.get(key);
        if (val)
            val = JSON.parse(val);
        return val;
    } catch (err) {
        handleGridError(grid, err);
        throw err;
    }
}

async function putIntoGrid(grid, key, value) {
    log.trace("begin putIntoGrid grid=%s, key=%s, value=%s", grid, key, value);
    await grid.put(key, JSON.stringify(value));
    log.trace("end putIntoGrid key=%s", key);
}

async function removeFromGrid(grid, key) {
    log.trace("begin removeFromGrid grid=%s, key=%s", grid, key);
    await grid.remove(key);
    log.trace("end removeFromGrid key=%s", key);
}

function putIntoGridAsync(grid, key, value) {
    log.trace("begin putIntoGridAsync grid=%s, key=%s, value=%s", grid, key, value);
    grid.put(key, JSON.stringify(value))
        .then(function() {
            log.trace("putIntoGridAsync success");
        })
        .catch(function(err) {
            log.warn("putIntoGridAsync failed - ignoring error %s", err);
            handleGridError(grid, err);
        });
    log.trace("end putIntoGridAsync");
}

function handleGridError(grid, err) {
    log.error("Grid error: %s", err);
    log.error("grid=%s", JSON.stringify(grid));
    readyState.datagridClient = false;
    readyState.lastError = err;
    //TODO: Try to reconnect
}

async function fireEventChangedEvent(event) {
    log.trace("begin fireEventChangedEvent");
    await putIntoGrid(gridEvents, event.eventID, event);
    log.trace("end fireEventChangedEvent");
}

function firePlaylistChangedEvent(eventID, playlist) {
    let key = eventID + ":" + playlist.playlistID;
    log.trace("begin firePlaylistChangedEvent key=%s", key);
    putIntoGridAsync(gridPlaylists, key, playlist);
    log.trace("end firePlaylistChangedEvent");
}

async function cleverCheckEvents() {
    log.trace("begin cleverCheckEvents");
    // The approach:
    // under the key "-1", we store a timestamp on when the last check was run.
    // if it is smaller then poll period, we are good
    // if it is greater then poll period, we try to update it (with verion)
    // if the update success, we did win and perform the check

    let entry = await gridEvents.getWithMetadata("-1");
    let now = new Date();
    if (entry) {
        log.trace("Last check was performed %s - now is %s", entry.value, now.toISOString());
        let lastCheck = new Date(entry.value);
        let delta = now.valueOf() - lastCheck.valueOf();

        if (delta < INTERNAL_POLL_INTERVAL) {
            log.trace("Last check was performed %s ago which is below internal poll interval of %s msec - nothing to do", delta, INTERNAL_POLL_INTERVAL);
        } else {
            log.trace("Last check is %s msec ago and above %s msec - try to enter crit sec with opt lock...", delta, INTERNAL_POLL_INTERVAL);
            let replaceOK = await gridEvents.replaceWithVersion("-1", now.toISOString(), entry.version);
            if (replaceOK) {
                log.info("cleverCheckEvents - do the check");
                let start = Date.now();
                await checkEvents();
                let stop = Date.now();
                let duration = stop - start;
                if (duration > INTERNAL_POLL_INTERVAL) {
                    log.fatal("!!!! checkEvents took %s msec which is longer then poll internval of %s", duration, INTERNAL_POLL_INTERVAL);
                    process.exit(43);
                } else {
                    log.info("checkEvents took %s msec", duration);
                }

            } else {
                log.trace("replace did not work - somebody else was faster, we can ignore this");
            }
        }

    } else {
        log.info("lastCheck Timestmap not present - creating it");
        await gridEvents.putIfAbsent("-1", now.toISOString());
    }

    log.trace("end cleverCheckEvents");
}


// -----------------------------------------------------------------------
// -----------------------------------------------------------------------
// ------------------------------ init stuff -----------------------------
// -----------------------------------------------------------------------
// -----------------------------------------------------------------------

setImmediate(async function() {
    try {
        log.info("Connecting to datagrid...");
        gridEvents = await connectToGrid("EVENT");
        gridPlaylists = await connectToGrid("PLAYLISTS");

        if (DEFAULT_TEST_EVENT_CREATE) {
            let testEvent = await getEventForEventID(DEFAULT_TEST_EVENT_ID);
            if (testEvent) {
                log.warn("Test event already present");
            } else {
                log.trace("Creating test event....");
                testEvent = createEmptyEvent();
                testEvent.eventID = DEFAULT_TEST_EVENT_ID;
                testEvent.name = "Demo Event";
                testEvent.owner = "OpenDJ";
                await fireEventChangedEvent(testEvent);

                log.trace("Creating test playlist....");
                let testList = createEmptyPlaylist(testEvent.eventID, testEvent.playlists[testEvent.activePlaylist]);
                await firePlaylistChangedEvent(testEvent.eventID, testList);

                log.info("Created test event with id " + testEvent.eventID);

                log.debug("Initial check of testEvent");
                await checkEvent(testEvent);
            }
        }
    } catch (err) {
        log.fatal("Init failed, something is seriously wrong. Will terminate.", err);
        process.exit(42);
    }

    log.info("Starting checkEvents() poll");
    setInterval(cleverCheckEvents, INTERNAL_POLL_INTERVAL);

    log.debug("opening server port");
    app.listen(PORT, function() {
        log.info('Now listening on port %s!', PORT);
    });

});