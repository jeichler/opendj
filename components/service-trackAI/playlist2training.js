'use strict';

const readline = require('readline');
const fs = require('fs');

const log4js = require('log4js')
const log = log4js.getLogger();
log.level = process.env.LOG_LEVEL || "trace";


const INPUT_LIST_SIZE = 25;

var outStream;

function outputBegin() {
    outStream = fs.createWriteStream('output.json');
    outStream.write("[");
}

function outputDataSet(dataset) {
    //    log.info(JSON.stringify(dataset, null, 4));
    outStream.write("   " + JSON.stringify(dataset) + ",\n");
}

function outputEnd() {
    outStream.write("]");
    outStream.end();
}

function createDatasetsFromSublist(tracklist) {
    for (let i = 0; i < tracklist.length - 1; i++) {
        //        log.trace("  i=%s, tl.len=%s", i, tracklist.length)
        let dataset = {};
        dataset.inNewTrack = tracklist[i];
        dataset.inCurrentList = tracklist.slice(); // Need to copy first
        dataset.inCurrentList.splice(i, 1); // Remove item #i
        dataset.outPos = i;
        outputDataSet(dataset);
    }
}

function deriveInputdataFromTracklist(tracklist) {
    log.trace("begin deriveInputdataFromTracklist");


    for (let pos = 0; pos < tracklist.length - INPUT_LIST_SIZE; pos++) {
        //        log.trace("pos=%s, tl.len=%s", pos, tracklist.length);
        let sublist = tracklist.slice(pos, pos + INPUT_LIST_SIZE + 1);
        createDatasetsFromSublist(sublist);
    }


    log.trace("end deriveInputdataFromTracklist");
}


function reduceTrackDetails(t) {
    let v = {};
    v.year = t.year;
    v.genre = t.genreSimpleNum;
    v.bpm = t.bpm;
    v.popularity = t.popularity;
    v.danceability = t.danceability;
    v.energy = t.energy;
    v.happiness = t.happiness;
    return v;
}

function createTracklist(playlist) {
    let tracklist = new Array();
    for (let i = 0; i < playlist.tracks.length; i++) {
        tracklist.push(reduceTrackDetails(playlist.tracks[i]));
    }
    return tracklist;
}

function loadPlaylistFromFile(fname) {
    log.trace("Loading playlist %s", fname);
    let playlist = JSON.parse(fs.readFileSync(fname));
    log.debug("Loaded playlist '%s' with %s tracks", playlist.meta.name, playlist.tracks.length);
    return playlist;
}

function addPlaylistFileToTrackMap(fname, trackmap) {
    let newPlaylist = loadPlaylistFromFile(fname);

    for (let i = 0; i < newPlaylist.tracks.length; i++) {
        let trackID = newPlaylist.tracks[i].id;
        let track = newPlaylist.tracks[i];
        trackmap.set(trackID, track);
    }
}

function outputTrackMap(map) {
    log.trace("begin outputTrackMap");

    const trackArray = [];
    for (const track of map.values()) {
        trackArray.push(track);
    }

    log.trace("write out file");
    const out = fs.createWriteStream('output.json');
    out.write(JSON.stringify(trackArray, null, 3));
    out.end();

    log.trace("end outputTrackMap");
}


// Main:
var mapOfTracks = new Map();
addPlaylistFileToTrackMap("rawdata/37i9dQZF1DX8a1tdzq5tbM.json", mapOfTracks);
addPlaylistFileToTrackMap("rawdata/37i9dQZF1DX9EM98aZosoy.json", mapOfTracks);
addPlaylistFileToTrackMap("rawdata/37i9dQZF1DWVWiyE9VDkCO.json", mapOfTracks);
addPlaylistFileToTrackMap("rawdata/37i9dQZF1DX4Y4RhrZqHhr.json", mapOfTracks);
addPlaylistFileToTrackMap("rawdata/37i9dQZF1DXaXB8fQg7xif.json", mapOfTracks);
addPlaylistFileToTrackMap("rawdata/37i9dQZF1DX7F6T2n2fegs.json", mapOfTracks);
addPlaylistFileToTrackMap("rawdata/37i9dQZF1DX8FwnYE6PRvL.json", mapOfTracks);
addPlaylistFileToTrackMap("rawdata/37i9dQZF1DX0IlCGIUGBsA.json", mapOfTracks);
addPlaylistFileToTrackMap("rawdata/37i9dQZF1DX1rVvRgjX59F.json", mapOfTracks);
addPlaylistFileToTrackMap("rawdata/37i9dQZF1DX1spT6G94GFC.json", mapOfTracks);
addPlaylistFileToTrackMap("rawdata/37i9dQZF1DWTJ7xPn4vNaz.json", mapOfTracks);
addPlaylistFileToTrackMap("rawdata/19PgP2QSGPcm6Ve8VhbtpG.json", mapOfTracks);
addPlaylistFileToTrackMap("rawdata/37i9dQZF1DWWzBc3TOlaAV.json", mapOfTracks);
addPlaylistFileToTrackMap("rawdata/1R0T3Qg2tlXVTj32YRKsHL.json", mapOfTracks);
addPlaylistFileToTrackMap("rawdata/439GRGyrRa8lcML6cuLtj0.json", mapOfTracks);
addPlaylistFileToTrackMap("rawdata/0Dl1xDgujU3jfiQp93XQh8.json", mapOfTracks);
//addPlaylistFileToTrackMap("rawdata/37i9dQZF1DX9wC1KY45plY.json", mapOfTracks);

outputTrackMap(mapOfTracks);