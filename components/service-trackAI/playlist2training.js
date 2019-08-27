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

function processPlaylistFile(fname) {
    let playlist = loadPlaylistFromFile(fname);
    let tracklist = createTracklist(playlist);
    outputBegin();
    deriveInputdataFromTracklist(tracklist);
    outputEnd();
}


// Main:
processPlaylistFile("rawdata/37i9dQZF1DWTJ7xPn4vNaz.json");