'use strict';

const compression = require('compression');
const express = require('express');
const app = express();
const request = require('request-promise-native');
const cors = require('cors');
const router = new express.Router();
const log4js = require('log4js');
const log = log4js.getLogger();
log.level = process.env.LOG_LEVEL || "trace";
const eventActivityClient = require('./EventActivityClient');

const COMPRESS_RESULT = process.env.COMPRESS_RESULT || "true";
const readyState = {
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
    let error = {
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
const TRACKAI_PROVIDER_URL = process.env.TRACKAI_PROVIDER_URL || "http://model-service:8080/predict";

// Defaults:
const TEST_EVENT_CREATE = (process.env.TEST_EVENT_CREATE || 'true') == 'true';
const TEST_EVENT_ID = (process.env.TEST_EVENT_ID || 'demo');
const DEFAULT_AUTOFILL_EMPTY_PLAYLIST = (process.env.DEFAULT_AUTOFILL_EMPTY_PLAYLIST || 'true') == 'true';
const DEFAULT_IS_PLAYING = (process.env.DEFAULT_IS_PLAYING || 'true') == 'true';
const DEFAULT_PROGRESS_PERCENTAGE_REQUIRED_FOR_EFFECTIVE_PLAYLIST = parseInt(process.env.DEFAULT_PROGRESS_PERCENTAGE_REQUIRED_FOR_EFFECTIVE_PLAYLIST || '75');
const DEFAULT_ALLOW_DUPLICATE_TRACKS = (process.env.DEFAULT_ALLOW_DUPLICATE_TRACKS || 'false') == 'true';
const MOCKUP_AUTOSKIP = parseInt(process.env.MOCKUP_AUTOSKIP_SECONDS || '0');
const MOCKUP_NO_ACTUAL_PLAYING = (process.env.MOCKUP_NO_ACTUAL_PLAYING || 'false') == 'true';
const INTERNAL_POLL_INTERVAL = parseInt(process.env.INTERNAL_POLL_INTERVAL || '10000');
const PAUSE_ON_PLAYERROR = (process.env.PAUSE_ON_PLAYERROR || 'true') == 'true';
const EVENT_URL = process.env.EVENT_URL || "localhost:8080";

const EVENT_PROTOTYPE = {
    eventID: "",
    url: "",
    name: "",
    owner: "",
    passwordOwner: "owner",
    passwordCurator: "opendj",
    passwordUser: "",
    maxUsers: 100,
    maxDurationInMinutes: 2880, //48h
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
    emojiTrackLike: '🥰',
    emojiTrackHate: '🤮',
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

    // For performance testing: 100 kind of randomly added tracks:
    "spotify:4m2RLN7imvsaLL1ZUGfFFw",
    "spotify:2EQA1eRfXvbHKMjSnzUtFD",
    "spotify:3dX6WDwnHwYzB5t754oB4T",
    "spotify:6l0LbTF2V77M3LPpcOBmqX",
    "spotify:1mv4lh1rW1K6xhxhJmEezy",
    "spotify:5koBIzuWS86S2IR36yt2LW",
    "spotify:0TqVsIuKYQTNsh1pmAF6Kn",
    "spotify:3SbCWIF7UaSewGfGHkFEI2",
    "spotify:4Y7beUNr43VUIOPxBJkYgE",
    "spotify:4wtR6HB3XekEengMX17cpc",
    "spotify:595nqFsvxhQ6CO2YG65W2D",
    "spotify:7kXmJwrZGIhDaLT9sNo3ut",
    "spotify:31gTL5XTmcI4JCSglW5Sda",
    "spotify:36sL3KPEfXIp5KH3tDO7oo",
    "spotify:3m4Mp1KfiPawsOjlRlbxN3",
    "spotify:2ECwcDngvqCBpLuQNyOZop",
    "spotify:4xGuK7FsXuZwHCCuNnPzbD",
    "spotify:4DAELRHy3hEpRwxLDOCqfq",
    "spotify:5n56ImOTTDbUORTq3Eyong",
    "spotify:2jBQYMPjY0UspZAVyYPRUG",
    "spotify:4LIbYKwuUBMKmqyZZC7XVg",
    "spotify:1o6xUqNNTV2bsWcNoV7zTQ",
    "spotify:2QGEeY7qFUPMapnkRg4ssa",
    "spotify:0F2BxpbxH8Yc3pLub48hrb",
    "spotify:2Ug4PnkxcwkcL3fhM0B9Xe",
    "spotify:3dXfF5w0an6cNZwVjLhHa0",
    "spotify:6yeO8fapOJGqL8Hr0Da2l3",
    "spotify:6a7mLvgueio7SuHgcacywb",
    "spotify:3vVdNuzFHL0hmT8Xq4vbhY",
    "spotify:1xrr9bAS0zfjCXdLKpLJnA",
    "spotify:1ZUWw5uRJEjjzTiP3Q4RJX",
    "spotify:12lTG2CsivVTCJH21qgkVz",
    "spotify:5Dx4wEpUGIdoSPNYoLVrmr",
    "spotify:1tmYcGyQJHestYnGel5y7c",
    "spotify:1HYiVTgxERP2llm0yFzVNj",
    "spotify:0yL1cs3O4Nw1si1bMGzecJ",
    "spotify:3RaCcyWwRIdczuefF10UCb",
    "spotify:6pqFWRuybCtxerWC7B4RgF",
    "spotify:7oyequ9whquaYyZXqB4LTZ",
    "spotify:6aMbSmv99DETtr97inIrJ4",
    "spotify:17FSlwAcuzwITI7cA1w0Lq",
    "spotify:5mAh5J4w6BEZkajB1M7XrB",
    "spotify:1pKYYY0dkg23sQQXi0Q5zN",
    "spotify:7fvkfIQ4AsdNxDd45yR02F",
    "spotify:6mMeuIonqBIcuzCGY5Soqe",
    "spotify:4LjfIjS8iweFCPdKxLnEoV",
    "spotify:5O71Sv4uv46dV9stV8Cujv",
    "spotify:2rVoUSkbUS0dbKrHkZN2mi",
    "spotify:62JXnYxY7u5JVLtpTbnOKw",
    "spotify:0ygoI3HcoGScxt879A23Uk",
    "spotify:1PJaIi4b7JV4QhBy6Obqoy",
    "spotify:2AnEHhSLWVJJMSQECOcyyx",
    "spotify:1EWsVHU4FNAdtN4R8FETag",
    "spotify:3KqXPyaLysWraUSi4PuSnz",
    "spotify:4V9HEnprK5MfCGL8bHHy7y",
    "spotify:223Vmr6rEbuujhHLFpsgVj",
    "spotify:2AXmhtQ9nLGGapHG2AeTZV",
    "spotify:4RQGig0Vhr4GXmqfklCCyK",
    "spotify:3uLSUZEmTY50H6Kw17lpfW",
    "spotify:0XJ2Ng4XAxKjzpst5drVdm",
    "spotify:4iLL2yVVG19TAJYssbMeBT",
    "spotify:1jKWGx7rruKRB2gwyHBtYN",
    "spotify:0cP5GxZrtKCRQu7cbOqsBe",
    "spotify:1IwrN4aytawDocT6JbqXCv",
    "spotify:1CgbwsrNDlFrRuk2ebQ7zr",
    "spotify:2RSxUNaF8EZI3B7guqXAPk",
    "spotify:3gVqtCpLK6tHeFbiU20QL6",
    "spotify:4PQCrz4sk00dIEmkwmmJCr",
    "spotify:4s3CHmungRHAI5ho2edqXb",
    "spotify:1Dj7hbBEco5ZT0DqY7Q2IV",
    "spotify:3KrwkQhiQc5ppjEXv1nDRZ",
    "spotify:2UBYNTJKvk9feVfW9f2ACK",
    "spotify:0DiWol3AO6WpXZgp0goxAV",
    "spotify:6k8cUsxbFMNoArTr2M0hEA",
    "spotify:6GbAqnbj3diM6MvVc1oiKt",
    "spotify:0EMyqiMNDRptenOpbe2mcK",
    "spotify:1uVeunZcBInXIQOwFWxSKL",
    "spotify:5W3cjX2J3tjhG8zb6u0qHn",
    "spotify:2OZrV4yyOZNuEFx22VVfFm",
    "spotify:1mNiQ0hVgB7xQZ938A8lIJ",
    "spotify:1hRFVIy9As8OVRk8B7CrD5",
    "spotify:4D869p0uPTcU4e1ClLB8Kj",
    "spotify:35cYPqBXqob7yitjk4Cx3M",
    "spotify:4HolTVfZ37wQTg0eO29J3k",
    "spotify:2b81QjZVYfa75vC5niRDac",
    "spotify:2hS4wCi2VAV8CdsLPnWIoD",
    "spotify:6eU60ONpRUQPIOiWaxfWOF",
    "spotify:65UKBA32AVBzthOGP62D2U",
    "spotify:7BuynvoA4xIt9LIwqhLwRu",
    "spotify:0yHlyAKqAF1KLKx8BMYhvq",
    "spotify:04hY9ZE6jatvZjsu1Q9nPc",
    "spotify:1OLNYVZejaOmBJ7ykGnyoG",
    "spotify:0l9xKcujIQJ4mDUgWb7852",
    "spotify:6A4Kuy7JL0Znab3Skgloiv",
    "spotify:3xV1sUd6aTE6Z98X1MtjC8",
    "spotify:1PAYgOjp1c9rrZ2kVQg2vN",
    "spotify:5JZnjM9ijpit0d5zjT8MM7",
    "spotify:1IaXcjEDGHHCNoNtK3xdf8",
    "spotify:0X7ELV6fLyjynJ3MexWh4X",
    "spotify:2DBZoeYzOGURGY3nj8XpC7",
];

function createEmptyEvent() {
    log.trace("begin createEmptyEvent");
    let event = JSON.parse(JSON.stringify(EVENT_PROTOTYPE));
    let now = new Date();
    let end = new Date();
    end.setTime(now.getTime() + event.maxDurationInMinutes * 60 * 1000);
    event.eventStartsAt = now.toISOString();
    event.eventEndsAt = end.toISOString();

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

function findTrackPositionInList(listOfTracks, provider, trackID) {
    log.trace("begin findTrackPositionInList");
    let result = -1;
    for (let i = 0; i < listOfTracks.length; i++) {
        let track = listOfTracks[i];
        if (track.id === trackID && track.provider === provider) {
            result = i;
            break;
        }
    }
    log.trace("end findTrackPositionInList result=%i", result);
    return result;
}

function findTrackInList(listOfTracks, provider, trackID) {
    log.trace("begin findTrackInList %s:%s", provider, trackID);
    let result = null;
    let pos = -1;

    for (let i = 0; i < listOfTracks.length; i++) {
        let track = listOfTracks[i];
        if (track.id === trackID && track.provider === provider) {
            pos = i;
            result = track;
            break;
        }
    }
    log.trace("end findTrackInList return track from position=%s", pos);
    return result;
}


async function getActivePlaylistForEvent(event) {
    log.trace("begin getActivePlaylistForEvent");
    let playlist = await getPlaylistWithID(event.eventID, event.activePlaylist);
    log.trace("end getActivePlaylistForEvent");
    return playlist;
}

function getETADateForTrackInPlayList(playlist, pos) {
    let ts = Date.now();
    if (playlist.currentTrack) {
        ts += (playlist.currentTrack.duration_ms - playlist.currentTrack.progress_ms);
    }
    for (let i = 0; i < pos; i++) {
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
    let result = [];
    log.debug("AUTOFILL event=%s", eventID);

    for (let trackID of emergencyTrackIDs) {
        let track = await getTrackDetailsForTrackID(eventID, trackID);
        track.added_by = "OpenDJ";
        result.push(track);
    }

    eventActivityClient.publishActivity('PLAYLIST_AUTOFILLED', eventID, { numTracks: emergencyTrackIDs.length }, 'OpenDJ added ' + emergencyTrackIDs.length + ' tracks')

    log.trace("createAutofillPlayList end eventID=%s len=%s", eventID, result.length);
    return result;
}


async function addTrack(event, playlist, provider, trackID, user) {
    log.trace("begin addTrack eventID=%s, playlistID=%s, provider=%s, track=%s", event.eventID, playlist.playlistID, provider, trackID);
    if (provider != "spotify") {
        log.error("Unkown provider %s", provider);
        throw { code: "PLYLST-100", msg: "Unknown provider " + provider + "! Currently, only spotify is implemented as provider" };
    }

    log.trace("check max tracks limit of event");
    if (playlist.nextTracks.length >= event.maxTracksInPlaylist) {
        throw { code: "PLYLST-115", msg: "Sorry, the playlist has reached it's maximum size of " + event.maxTracksInPlaylist + " tracks. Please come back later!" };
    }

    log.trace("check next tracks for duplicate")
    let pos = findTrackPositionInList(playlist.nextTracks, provider, trackID);
    if (pos >= 0) {
        log.debug("ADD rejected because in playlist at pos %s", pos);
        let eta = getETADateForTrackInPlayList(playlist, pos);
        eta = eta.toTimeString().split(' ')[0];
        eta = eta.substring(0, 5);

        throw { code: "PLYLST-110", msg: "Sorry, this track is already in the playlist at position #" + (pos + 1) + " and is expected to be played around " + eta + "!" };
    }

    if (!event.allowDuplicateTracks) {
        log.trace("duplicates not allowed, search for track in effective playlist");
        pos = findTrackPositionInList(event.effectivePlaylist, provider, trackID);
        if (pos >= 0) {
            log.debug("ADD rejected because not duplicated allowed and track is in effective playlist");
            throw { code: "PLYLST-120", msg: "Sorry, this event does not allow duplicate tracks, and this track has already been played at " + event.effectivePlaylist[pos].started_at };
        }
    }

    // Okay, track can be added. Let's get the details
    try {
        let track = await getTrackDetailsForTrackID(event.eventID, provider + ":" + trackID);
        if (user)
            track.added_by = user;
        else
            track.added_by = "?";

        if (event.enableTrackAI) {
            log.trace("TrackAI enabled - call model service at " + TRACKAI_PROVIDER_URL);

            let pos = 0;

            try {
                track.cluster_id = -1;

                let response = await request.post({
                    url: TRACKAI_PROVIDER_URL,
                    body: { 'newTrack': track, 'currentList': playlist.nextTracks, 'position': -42 },
                    json: true
                });

                log.trace("response from model service", JSON.stringify(response));
                // let body = JSON.parse(response);
                let body = response;

                // We get the track with the new cluster_id attribute back, so we need to store it:
                track = body.newTrack;
                pos = body.position;
                log.debug("position from model service", pos);
            } catch (aiFailed) {
                log.error("Calling model service failed", aiFailed);
            }

            log.debug("TrackAI enabled - adding new track as pos ", pos);
            playlist.nextTracks.splice(pos, 0, track);
        } else {
            log.trace("TrackAI disabled, adding to the end of the list");
            playlist.nextTracks.push(track);

            eventActivityClient.publishActivity(
                'TRACK_ADDED',
                event.eventID, { userID: user, trackID: provider + ':' + trackID, playlistID: playlist.playlistID, track: track },
                user + " contributed " + track.name
            );

        }
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

    log.trace("end addTrack eventID=%s, playlistID=%s, provider=%s, track=%s", event.eventID, playlist.playlistID, provider, trackID);
}

function moveTrack(eventID, playlist, provider, trackID, newPos, user) {
    log.trace("begin moveTrack eventID=%s, playlistID=%s, provider=%s, track=%s, newPos=%s", eventID, playlist.playlistID, provider, trackID, newPos);

    let currentPos = findTrackPositionInList(playlist.nextTracks, provider, trackID);
    if (currentPos < 0) {
        throw { code: "PLYLST-200", msg: "Track not found in playlist - maybe somebody else has deleted it meanwhile?" };
    }

    // Sanity check of new pos:
    let len = playlist.nextTracks.length;
    if (newPos < 0) newPos = 0;
    if (newPos > len) newPos = len;

    // Remove at current pos:
    let track = playlist.nextTracks.splice(currentPos, 1)[0];

    // Insert at new pos;
    playlist.nextTracks.splice(currentPos < newPos ? newPos - 1 : newPos, 0, track);

    eventActivityClient.publishActivity(
        'TRACK_MOVED',
        eventID, { userID: user, trackID: provider + ':' + trackID, playlistID: playlist.playlistID, currentPos: currentPos, newPos: newPos, track: track },
        '' + user + ' moved ' + track.name + ' from pos ' + currentPos + ' to ' + newPos
    );


    log.trace("end moveTrack eventID=%s, playlistID=%s, provider=%s, track=%s", eventID, playlist.playlistID, provider, track);
}

function deleteTrack(eventID, playlist, provider, trackID, user) {
    log.trace("begin deleteTrack eventID=%s, playlistID=%s, provider=%s, track=%s", eventID, playlist.playlistID, provider, trackID);

    let currentPos = findTrackPositionInList(playlist.nextTracks, provider, trackID);
    if (currentPos < 0) {
        throw { code: "PLYLST-200", msg: "Track not found in playlist - maybe somebody else has deleted it meanwhile?" };
    }

    // Remove at current pos:
    let track = playlist.nextTracks.splice(currentPos, 1)[0];

    eventActivityClient.publishActivity(
        'TRACK_DELETED',
        eventID, { userID: user, trackID: provider + ':' + trackID, playlistID: playlist.playlistID, currentPos: currentPos, track: track },
        '' + user + ' deleted ' + track.name + ' at position ' + currentPos
    );

    log.trace("end deleteTrack eventID=%s, playlistID=%s, provider=%s, track=%s", eventID, playlist.playlistID, provider, trackID);
}

function ensureFeedbackAttributes(track) {
    if (!track.numLikes) {
        track.numLikes = 0;
    }
    if (!track.numHates) {
        track.numHates = 0;
    }
}

function trackFeedbackSanityCheck(track) {
    if (track.numLikes < 0) {
        track.numLikes = 0;
    }
    if (track.numHates < 0) {
        track.numHates = 0;
    }
}



function provideTrackFeedback(eventID, playlist, provider, trackID, feedback, user) {
    log.trace("begin provideTrackFeedback eventID=%s, playlistID=%s, provider=%s, trackID=%s", eventID, playlist.playlistID, provider, trackID);

    let track = findTrackInList(playlist.nextTracks, provider, trackID);
    let stateChanged = false;

    if (track) {
        let activityMsg = '?';

        ensureFeedbackAttributes(track);
        let oldFeedback = feedback.old ? feedback.old : '';
        let newFeedback = feedback.new ? feedback.new : '';
        log.debug("trackFeedback before: old=%s new=%s, likes=%s, hates=%s", oldFeedback, newFeedback, track.numLikes, track.numHates);

        if (oldFeedback === 'H' && newFeedback === 'L') {
            log.trace("User changed her mind from hate to like, thus we need to reduce hate counter.");
            track.numHates--;
            activityMsg = '' + user + ' changed mind from hate to like regarding ' + track.name;
        }
        if (oldFeedback === 'L' && newFeedback === 'H') {
            log.trace("User changed her mind from like to hate, thus we need to reduce hate counter");
            track.numLikes--;
            activityMsg = '' + user + ' changed mind from like to hate regarding ' + track.name;
        }

        if (oldFeedback === 'L' && newFeedback === '') {
            log.trace("User liked in the past and now clicked like again, meaning to remove the like");
            track.numLikes--;
            activityMsg = '' + user + ' does not like anymore ' + track.name;
        } else if (newFeedback === 'L') {
            log.trace("User liked new");
            track.numLikes++;
            activityMsg = '' + user + ' liked track ' + track.name;
        }

        if (oldFeedback === 'H' && newFeedback === '') {
            log.trace("User liked in the past and now clicked like again, meaning to remove the like");
            track.numHates--;
            activityMsg = 'User ' + user + ' does not hate anymore ' + track.name;
        } else if (newFeedback === 'H') {
            log.trace("User hates new");
            track.numHates++;
            activityMsg = '' + user + ' hated ' + track.name;
        }

        trackFeedbackSanityCheck(track);
        stateChanged = true;
        log.debug("trackFeedback after:  old=%s new=%s, likes=%s, hates=%s", oldFeedback, newFeedback, track.numLikes, track.numHates);

        eventActivityClient.publishActivity(
            'TRACK_FEEDBACK',
            eventID, { userID: user, trackID: provider + ':' + trackID, playlistID: playlist.playlistID, feedback: feedback, track: track },
            activityMsg
        );


    } else {
        log.info("provideTrackFeedback IGNORED - track %s:%s not found in playlist - maybe it has been deleted meanwhile ", provider, trackID)
    }

    log.trace("end provideTrackFeedback eventID=%s, playlistID=%s, provider=%s, trackID=%s", eventID, playlist.playlistID, provider, trackID);
    return stateChanged;
}

function updateCurrentTrackProgress(playlist) {
    if (playlist.isPlaying && playlist.currentTrack) {
        let newPos = Date.now() - Date.parse(playlist.currentTrack.started_at);
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

    let now = Date.now();
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
        log.debug("Demo No Actual Playing is active for event %s - play request is NOT actually being executed", event.eventID);
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

                // Make sure to persist this state change:
                firePlaylistChangedEvent(event.eventID, playlist);
            }
            throw { code: "PLYLST-300", msg: "Could not play track. Err=" + err };
        }
    }

    eventActivityClient.publishActivity(
        'TRACK_PLAY',
        event.eventID, { trackID: playlist.currentTrack.provider + ':' + playlist.currentTrack.id, playlistID: playlist.playlistID, track: playlist.currentTrack },
        'Now playing: ' + playlist.currentTrack.name
    );

    // Start playing was successful!
    log.info("PLAY event=%s, playlist=%s, track=%s, startAt=%s, name=%s", event.eventID, playlist.playlistID, playlist.currentTrack.id, playlist.currentTrack.progress_ms, playlist.currentTrack.name);
    setTimerForEvent(event, playlist);


    log.trace("play end event=%s, playlist=%s", event.eventID, playlist.playlistID);
}

async function pause(event, playlist, err, user) {
    log.info("PAUSE event=%s, playlist=%s", event.eventID, playlist.playlistID);
    // Make sure we take note of the current progress:
    updateCurrentTrackProgress(playlist);
    playlist.isPlaying = false;
    clearTimerForEvent(event.eventID);


    if (event.demoNoActualPlaying) {
        log.debug("Demo No Actual Playing is active for event %s - pause request is NOT actually being executed", event.eventID);
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

    if (!err) {
        eventActivityClient.publishActivity(
            'TRACK_PAUSE',
            event.eventID, { trackID: playlist.currentTrack.provider + ':' + playlist.currentTrack.id, playlistID: playlist.playlistID, track: playlist.currentTrack },
            'Playback paused for ' + playlist.currentTrack.name + ' by ' + user
        );
    }

}


async function skip(event, playlist, user) {
    log.trace("skip begin");
    log.debug("SKIP event=%s, playlist=%s", event.eventID, playlist.playlistID);

    if (playlist.isPlaying && playlist.currentTrack) {
        log.trace("skipping current track");
        let progressPercentage = Math.round((playlist.currentTrack.progress_ms / playlist.currentTrack.duration_ms) * 100);
        if (progressPercentage >= event.progressPercentageRequiredForEffectivePlaylist) {
            log.debug("adding current track to effectivePlaylist")
            event.effectivePlaylist.push(playlist.currentTrack);
            fireEventChangedEvent(event);
        } else {
            log.debug("Track was skipped at %s\%, which is below required %s\% for effective playlist, so NOT adding it",
                progressPercentage, event.progressPercentageRequiredForEffectivePlaylist);
        }
    }

    // Note SKIP Event only if actually skipped by a user, not at regular "skip" and the end of the current track_
    if (playlist.currentTrack && (!playlist.isPlaying || isTrackPlaying(event, playlist))) {
        eventActivityClient.publishActivity(
            'TRACK_SKIP',
            event.eventID, { trackID: playlist.currentTrack.provider + ':' + playlist.currentTrack.id, playlistID: playlist.playlistID, track: playlist.currentTrack },
            '' + playlist.currentTrack.name + ' was skipped by ' + user
        );
    }

    let lastTrack = playlist.currentTrack;


    playlist.currentTrack = playlist.nextTracks.shift();
    if (playlist.currentTrack) {
        log.debug("SKIP to next track");
        playlist.currentTrack.progress_ms = 0;
        if (playlist.isPlaying) {
            await play(event, playlist);
        }
    } else {
        log.debug("SKIP: reached end of playlist");
        playlist.currentTrack = null;
        clearTimerForEvent(event.eventID);

        log.trace("Check for autofill");
        let stateChanged = await autofillPlaylistIfNecessary(event, playlist);
        if (stateChanged && playlist.isPlaying) {
            log.trace("stateChanged and isPlaying")
            if (playlist.isPlaying) {
                log.trace("playlist auto filled - pressing play again");
                await play(event, playlist);
            } else {
                log.trace("playlist auto filled but not playing");
            }
        } else if (lastTrack) {
            log.trace("This is really the end - stop the music");
            try {
                if (event.demoNoActualPlaying) {
                    log.debug("demo active - pause request at end of playlist is NOT actually being executed");
                } else {
                    log.debug("calling provider %s to pause", lastTrack.provider);
                    let result = await request(SPOTIFY_PROVIDER_URL + "events/" + event.eventID + "/providers/" + lastTrack.provider + "/pause");
                    log.debug("pause provider %s result=%s", lastTrack.provider, result);
                }
            } catch (err) {
                log.warn("call to spotify pause at end of playlist failed - ignoring err=" + err);
            };
        } else {
            log.trace("nothing to do here");
        }
    }
    log.trace("skip end");
}

function isTrackPlaying(event, playlist) {
    let result = false;
    log.trace("isTrackPlaying begin id=%s", playlist.playlistID);

    if (playlist.isPlaying) {
        if (playlist.currentTrack) {
            log.trace("   current track is present");
            updateCurrentTrackProgress(playlist);
            let currentPos = playlist.currentTrack.progress_ms;

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
                        log.debug("AutoSkipping");
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
            log.debug("AutoFilling Playlist %s of event %s....", playlist.playlistID, event.eventID);
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
    let stateChanged = await autofillPlaylistIfNecessary(event, playlist, 'OpenDJ');

    if (playlist.isPlaying && !isTrackPlaying(event, playlist)) {
        log.trace("playlist is playing but no track is playing - skipping to next track");
        await skip(event, playlist, 'OpenDJ');
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
    log.trace("begin checkEvent");
    try {
        if (event) {
            log.debug("checkEvent for id %s", event.eventID);

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
        } else {
            log.debug("checkEvent - ignored for non-existing event");
        }
    } catch (err) {
        log.error("checkEvent %s failed with err %s - ignored", event.eventID, err);
    }
    log.trace("end checkEvent");
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

    eventActivityClient.publishActivity(
        'EVENT_CREATE',
        event.eventID, { event: event },
        'Event ' + event.eventID + ' created by ' + event.owner
    );

    log.trace("end createEvent");
}
async function updateEvent(event) {
    log.trace("begin updateEvent");
    event = await validateEvent(event, false);
    fireEventChangedEvent(event);

    eventActivityClient.publishActivity(
        'EVENT_UPDATE',
        event.eventID, { event: event },
        'Event ' + event.eventID + ' updated by ' + event.owner
    );

    log.trace("end updateEvent");
}

async function deleteEvent(eventID) {
    log.trace("begin deleteEvent id=%s", eventID);

    let event = await getEventForEventID(eventID);
    if (event) {
        log.debug("deleteEvent %s - found in grid", eventID);

        // We delete the event by setting the end date to now.
        // This will cause the housekeeper to perform the actual delete:
        event.eventEndsAt = new Date().toISOString();
        fireEventChangedEvent(event);
        log.info("EVENT MARKED FOR DELETION %s", eventID);

        eventActivityClient.publishActivity(
            'EVENT_DELETE',
            event.eventID, { event: event },
            'Event ' + event.eventID + ' deleted by ' + event.owner
        );
    } else {
        log.warn("deleteEvent ignored because event with id %s not found", eventID);
    }

    log.trace("end deleteEvent");
}


async function validateEvent(event, isCreate) {
    log.trace("begin validateEvent isCreate=%s", isCreate);
    let listOfValidationErrors = new Array();

    event.eventID = event.eventID.toLowerCase();
    if (isCreate) {
        // check if ID is existing:
        let otherEvent = await getEventForEventID(event.eventID);
        if (otherEvent) {
            listOfValidationErrors.push({ code: "EVENT-100", msg: "An Event with this ID already exists", att: "eventID" });
        }
    }

    // Adjust URL:
    event.url = EVENT_URL + "/" + event.eventID;

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
    try {
        let playlist = await getPlaylistForRequest(req);
        updateCurrentTrackProgress(playlist);
        res.status(200).send(playlist);
    } catch (err) {
        handleError(err, res);
    }
});

router.get('/events/:eventID/playlists/:listID/currentTrack', async function(req, res) {
    try {
        log.trace("begin GET currentTrack eventId=%s, listId=%s", req.params.eventID, req.params.listID);
        let playlist = await getPlaylistForRequest(req);
        updateCurrentTrackProgress(playlist);
        res.status(200).send(playlist.currentTrack);
    } catch (err) {
        handleError(err, res);
    }
});

router.get('/events/:eventID/playlists/:listID/tracks', async function(req, res) {
    try {
        log.trace("begin GET tracks eventId=%s, listId=%s", req.params.eventID, req.params.listID);
        let playlist = await getPlaylistForRequest(req);
        updateCurrentTrackProgress(playlist);
        res.status(200).send(playlist.nextTracks);
    } catch (err) {
        handleError(err, res);
    }
});


router.get('/events/:eventID/playlists/:listID/play', async function(req, res) {
    log.trace("begin PLAY tracks eventId=%s, listId=%s", req.params.eventID, req.params.listID);

    let event = await getEventForRequest(req);
    let playlist = await getPlaylistForRequest(req);
    let user = req.query.user;
    play(event, playlist, user)
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
    let event = await getEventForRequest(req);
    let playlist = await getPlaylistForRequest(req);
    let user = req.query.user;

    pause(event, playlist, null, user).then(function() {
        firePlaylistChangedEvent(event.eventID, playlist);
        res.status(200).send(playlist);
    }).catch(function(err) {
        log.debug("pause failed with err", err);
        res.status(500).send(err);
    });

});

router.get('/events/:eventID/playlists/:listID/next', async function(req, res) {
    log.trace("begin NEXT playlist eventId=%s, listId=%s", req.params.eventID, req.params.listID);
    let event = await getEventForRequest(req);
    let playlist = await getPlaylistForRequest(req);
    let user = req.query.user;

    skip(event, playlist, user).then(function() {
        firePlaylistChangedEvent(event.eventID, playlist);
        res.status(200).send(playlist);
    }).catch(function(err) {
        log.debug("pause failed with err", err);
        res.status(500).send(err);
    });
});

router.get('/events/:eventID/playlists/:listID/push', async function(req, res) {
    try {
        log.trace("begin SKIP playlist eventId=%s, listId=%s", req.params.eventID, req.params.listID);
        let playlist = await getPlaylistForRequest(req);
        firePlaylistChangedEvent(req.params.eventID, playlist);
        res.status(200).send(playlist);
    } catch (err) {
        handleError(err, res);
    }
});

// Add Track:
router.post('/events/:eventID/playlists/:listID/tracks', async function(req, res) {
    if (log.isTraceEnabled()) {
        log.trace("begin ADD track playlist eventId=%s, listId=%s", req.params.eventID, req.params.listID);
        log.trace("body=%s", JSON.stringify(req.body));
    }

    try {
        let event = await getEventForRequest(req);
        let playlist = await getPlaylistForRequest(req);
        let provider = req.body.provider;
        let trackID = req.body.id;
        let user = req.body.user;

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
        let user = req.body.user;

        moveTrack(req.params.eventID, playlist, provider, trackID, to, user);
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
        let [provider, trackID] = splitTrackIDIntoProviderAndTrack(req.params.track);
        let user = req.query.user;

        deleteTrack(req.params.eventID, playlist, provider, trackID, user);

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

// Provide Track Feedback:
// Reorder // move Track:
router.post('/events/:eventID/playlists/:listID/tracks/:track/feedback', async function(req, res) {
    log.trace("begin provideTrackFeedback eventId=%s, listId=%s, track=%s", req.params.eventID, req.params.listID, req.params.track);
    log.trace("body=%s", JSON.stringify(req.body));

    try {
        let playlist = await getPlaylistForRequest(req);
        let [provider, trackID] = splitTrackIDIntoProviderAndTrack(req.params.track);;
        let feedback = req.body;
        let user = req.body.user;

        let stateChanged = provideTrackFeedback(req.params.eventID, playlist, provider, trackID, feedback, user);
        if (stateChanged)
            firePlaylistChangedEvent(req.params.eventID, playlist);
        res.status(200).send();
    } catch (error) {
        log.debug(error);
        // Probably a track not found problem:
        // 406: Not Acceptable
        res.status(406).send(JSON.stringify(error));
    }
});



// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// ------------------------------ routes: heath stuff -----------------------------
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
function readyAndHealthCheck(req, res) {
    log.trace("begin readyAndHealthCheck");
    let status = 500;

    if (readyState.datagridClient) {
        status = 200;
    }

    res.status(status).send(JSON.stringify(readyState));
    log.trace("end readyAndHealthCheck status=", status);
}

router.get('/ready', readyAndHealthCheck);
router.get('/health', readyAndHealthCheck);



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
var gridEventLck = null;

async function connectToGrid(name) {
    let grid = null;
    try {
        log.debug("begin connectToGrid %s", name);
        let splitter = DATAGRID_URL.split(":");
        let host = splitter[0];
        let port = splitter[1];
        grid = await datagrid.client([{ host: host, port: port }], { cacheName: name, mediaType: 'application/json' });
        readyState.datagridClient = true;
        log.info("CONNECTED to grid %s", name);
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
    log.fatal("!!! Grid error !!!", err);
    readyState.datagridClient = false;
    readyState.lastError = err;
    process.exit(44);
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
    // if it is greater then poll period, we try to update it (with version)
    // if the update success, we did win and perform the check

    try {
        let entry = await gridEventLck.getWithMetadata("-1");
        log.trace("entry = ", JSON.stringify(entry));
        let now = new Date();
        if (entry) {
            log.trace("Last check was performed %s - now is %s", entry.value, now.toISOString());
            let lastCheck = new Date(entry.value);
            let delta = now.valueOf() - lastCheck.valueOf();
            readyState.lastGlobalEventCheck = lastCheck.toISOString();

            if (delta < INTERNAL_POLL_INTERVAL) {
                log.trace("Last check was performed %s ago which is below internal poll interval of %s msec - nothing to do", delta, INTERNAL_POLL_INTERVAL);
            } else {
                log.trace("Last check is %s msec ago and above %s msec - try to enter crit sec with opt lock=>%s<", delta, INTERNAL_POLL_INTERVAL, JSON.stringify(entry.version));
                let replaceOK = await gridEventLck.replaceWithVersion("-1", now.toISOString(), entry.version);
                if (replaceOK) {
                    log.debug("cleverCheckEvents - do the check");
                    let start = Date.now();
                    await checkEvents();
                    let stop = Date.now();
                    let duration = stop - start;
                    if (duration > INTERNAL_POLL_INTERVAL) {
                        throw "checkEvents took %s msec which is longer then poll interval of %s", duration, INTERNAL_POLL_INTERVAL;
                    } else {
                        log.debug("checkEvents took %s msec", duration);
                    }

                } else {
                    log.trace("replace did not work - somebody else was faster, we can ignore this");
                }
            }

        } else {
            log.debug("lastCheck Timestnot present - creating it");
            await gridEventLck.putIfAbsent("-1", now.toISOString());
        }
    } catch (err) {
        log.fatal("!!! cleverCheckEvents failed", err);
        process.exit(43);
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
        log.debug("Connecting to datagrid...");
        gridEvents = await connectToGrid("EVENTS");
        gridEventLck = await connectToGrid("EVENT_LCK");
        gridPlaylists = await connectToGrid("PLAYLISTS");

        if (TEST_EVENT_CREATE) {
            let testEvent = await getEventForEventID(TEST_EVENT_ID);
            if (testEvent) {
                log.debug("Test event already present");
            } else {
                log.debug("Creating test event....");
                testEvent = createEmptyEvent();
                testEvent.eventID = TEST_EVENT_ID;
                testEvent.name = "Demo Event";
                testEvent.owner = "OpenDJ";
                testEvent.url = EVENT_URL + "/" + testEvent.eventID;
                testEvent.eventEndsAt = new Date(Date.now() + 42 * 365 * 24 * 60 * 60 * 1000).toISOString();
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