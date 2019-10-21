const compression = require('compression');
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const router = new express.Router();
const cors = require('cors');
const io = require('socket.io')(http, { origins: '*:*', path: '/api/service-web/socket' });

const port = process.env.PORT || 3000;
const log4js = require('log4js')
const log = log4js.getLogger();
log.level = process.env.LOG_LEVEL || "trace";
app.use(cors());
app.use(compression())
app.use("/api/service-web/v1", router);

var readyState = {
    datagridClient: false,
    websocket: false,
    lastError: ""
};



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
        grid = await datagrid.client([{ host: host, port: port }], { cacheName: name, mediaType: 'application/json' });
        readyState.datagridClient = true;
        log.debug("connectToGrid grid=%s client=%s", name, grid);
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

function handleGridError(grid, err) {
    log.fatal("!!! Grid error", err);
    readyState.datagridClient = false;
    readyState.lastError = err;
    process.exit(44);
}

async function addCUDListenerForGrid(grid, listener) {
    log.trace("begin addCUDListenerForGrid grid=%s", grid);
    let listenerID = await grid.addListener('create', listener);
    await grid.addListener('modify', listener, { listenerId: listenerID });
    await grid.addListener('remove', listener, { listenerId: listenerID });
    await grid.addListener('expiry', listener, { listenerId: listenerID });
}

async function connectToDatagrid() {
    log.info("Connecting to datagrid...");
    gridEvents = await connectToGrid("EVENTS");
    gridPlaylists = await connectToGrid("PLAYLISTS");


    log.debug("Register listeners...");
    await addCUDListenerForGrid(gridEvents, onEventModified);
    await addCUDListenerForGrid(gridPlaylists, onPlaylistModified);

    log.debug("Connecting to datagrid...DONE");
    readyState.datagridClient = true;
}

async function checkGridConnection() {
    log.trace("begin checkGridConnection");
    let result = false;
    for (let i = 0; i < 3; i++) {

        try {
            await gridEvents.get("-1");
            readyState.datagridClient = true;
            readyState.lastError = "";
            result = true;
        } catch (err) {
            readyState.datagridClient = false;
            readyState.lastError = err;
            log.error("checkGridConnection failed - try to reconnect", err);
            try {
                await connectToDatagrid();
            } catch (reconnectError) {
                log.debug("checkGridConnection: re-connect error ignored", reconnectError);
            }
        }
    }

    log.trace("end checkGridConnection result=", result);
    return result;
}


async function onPlaylistModified(key, entryVersion, listenerID) {
    log.trace("begin onPlaylistModified key=%s", key);
    try {
        if (key.indexOf(':') < 0) {
            log.debug("onPlaylistModified: ignore strange event with key %s", key);
            return;
        }

        let splitter = key.split(":");
        let eventID = splitter[0];
        let playlistID = splitter[1];

        let playlist = await getPlaylistForPlaylistID(key);
        let namespace = io.of("/event/" + eventID);
        emitPlaylist(namespace, playlist);
    } catch (err) {
        log.error("onPlaylistModified  failed - ignoring err=%s", err);
    }

    log.trace("end onPlaylistModified key=%s", key);
}

async function onEventModified(key, entryVersion, listenerID) {
    log.trace("begin onEventModified key=%s", key);
    try {
        if (key.indexOf(':') > 0) {
            log.trace("onEventModified: ignore strange event with key %s", key);
        } else if ("-1" == key) {
            log.trace("ignoring event key used for clever event checking");
        } else {
            log.trace("get and emit eventID=%s", key);
            let eventID = key;
            let event = await getEventForEventID(key);
            let namespace = io.of("/api/service-web/socket/event/" + eventID);
            emitEvent(namespace, event);
        }
    } catch (err) {
        log.error("onEventModified failed - ignoring err=%s", err);
    }

    log.trace("end onEventModified key=%s", key);
}


async function getEventForEventID(eventID) {
    log.trace("begin getEventForEventID id=%s", eventID);
    let event = await getFromGrid(gridEvents, eventID);
    if (event == null) {
        log.warn("getEventForEventID event is null for id=%s", eventID);
    } else {
        if (log.isTraceEnabled())
            log.trace("event from grid = %s", JSON.stringify(event));
    }
    log.trace("end getEventForEventID id=%s", eventID);
    return event;
}
async function getPlaylistForPlaylistID(playlistID) {
    log.trace("begin getPlaylistForPlaylistID id=%s", playlistID);
    let playlist = await getFromGrid(gridPlaylists, playlistID);
    if (playlist == null) {
        log.warn("getPlaylistForPlaylistID event is null for id=%s", playlistID);
    } else {
        if (log.isTraceEnabled())
            log.trace("playlist from grid = %s", JSON.stringify(playlist));
    }
    log.trace("end getPlaylistForPlaylistID id=%s", playlistID);
    return playlist;
}


// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ------------------------------ websocket stuff -----------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
function getEventIDFromSocketNamespace(socket) {
    const nsp = socket.nsp;
    let eventID = null;
    if (nsp && nsp.name && nsp.name.startsWith("/event/"))
        eventID = nsp.name.slice("/event/".length);
    log.trace("getEventIDFromSocketNamespace eventID=%s", eventID);
    return eventID;
}


function emitPlaylist(socketOrNamespace, playlist) {
    log.trace("begin emitPlaylist id=%s", playlist.playlistID);

    log.trace("nsp=%s", socketOrNamespace.nsp);

    socketOrNamespace.emit('current-playlist', playlist);
    log.trace("end emitPlaylist id=%s", playlist.playlistID);
}

function emitEvent(socketOrNamespace, event) {
    log.trace("begin emitEvent");
    if (event) {
        log.debug("emitEvent current-event for ID=%s", event.eventID);
    } else {
        log.debug("emitEvent current-event with null - aka delete-event");
    }
    socketOrNamespace.emit("current-event", event);
    log.trace("end emitEvent");
}

async function emitEventToSocket(socket) {
    log.trace("begin emitEventToSocket");
    let eventID = getEventIDFromSocketNamespace(socket);
    let currentEvent = await getEventForEventID(eventID);
    log.debug("emit current-event %s to socket %s", eventID, socket.id);
    emitEvent(socket, currentEvent);
    log.trace("end emitEventToSocket");
}

async function onRefreshEvent(socket) {
    log.trace("begin onRefreshEvent socket.id=%s", socket.id);
    try {
        await emitEventToSocket(socket);
    } catch (err) {
        log.error("onRefreshEvent failed - ignoring err %s", err);
    }
    log.trace("end onRefreshEvent socket.id=%s", socket.id);
}

async function onRefreshPlaylist(socket) {
    log.trace("begin onRefreshPlaylist socket.id=%s", socket.id);
    try {
        let eventID = getEventIDFromSocketNamespace(socket);
        let event = await getEventForEventID(eventID);
        if (event) {
            let playlist = await getPlaylistForPlaylistID(eventID + ":" + event.activePlaylist);
            emitPlaylist(socket, playlist);
        } else {
            log.debug("ignoring refresh request for non-existing playlist - probably it has been deleted");
        }
    } catch (err) {
        log.error("onRefreshPlaylist failed - ignoring err %s", err);
    }
    log.trace("end onRefreshPlaylist socket.id=%s", socket.id);
}

function onDisconnect(socket) {
    // Not really something to do for us:
    log.debug('socket %s disconnected from event %s', socket.id, getEventIDFromSocketNamespace(socket));
}


async function onWebsocketConnection(socket) {
    log.trace("begin onWebsocketConnection socket.id=%s", socket.id);

    const eventID = getEventIDFromSocketNamespace(socket);

    if (eventID) {
        log.debug('socket %s connected to event %s', socket.id, eventID);

        log.debug("Register callbacks");
        socket.on('refresh-event', function() {
            onRefreshEvent(socket);
        });
        socket.on('refresh-playlist', function() {
            onRefreshPlaylist(socket);
        });

        socket.on('disconnect', function() {
            onDisconnect(socket);
        });

        try {
            // Send Welcome Package:
            let eventID = getEventIDFromSocketNamespace(socket);
            let event = await getEventForEventID(eventID);
            if (event) {
                emitEvent(socket, event);
                let playlist = await getPlaylistForPlaylistID(eventID + ":" + event.activePlaylist);
                if (playlist) {
                    emitPlaylist(socket, playlist);
                } else {
                    log.warn("onWebsocketConnection: no active playlist with ID %s for event %s in grid", event.activePlaylist, eventID);
                }
            } else {
                log.warn("onWebsocketConnection: no event with ID %s in grid", eventID);
            }
        } catch (err) {
            log.error("onWebsocketConnection sent welcome package failed - ignoring err %s", err);
        }

    } else {
        log.warn("Socket connect without namespace - disconnecting");
        socket.disconnect(true);
    }

    log.trace("end onWebsocketConnection socket.id=%s", socket.id);
}

// Register Dynamic namespaces with IO:
log.trace("Register websocket namespace");

io.of(/^\/event\/.+$/)
    .on('connect', onWebsocketConnection);

/*
io.of("/event/0")
    .on('connect', onWebsocketConnection);
*/

//io.on('connect', onWebsocketConnection);

// -----------------------------------------------------------------------
// -----------------------------------------------------------------------
// ------------------------------ Web routes -----------------------------
// -----------------------------------------------------------------------
// -----------------------------------------------------------------------


async function readyAndHealthCheck(req, res) {
    log.trace("begin readyAndHealthCheck");
    // Default: not ready:
    let status = 500;
    let gridOkay = await checkGridConnection();
    if (readyState.datagridClient &&
        readyState.websocket &&
        gridOkay) {
        status = 200;
    }

    res.status(status).send(JSON.stringify(readyState));
    log.trace("end readyAndHealthCheck status=", status);
}

router.get('/ready', readyAndHealthCheck);
router.get('/health', readyAndHealthCheck);

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ------------------------------ init stuff -----------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
setImmediate(async function() {
    try {
        await connectToDatagrid();

        http.listen(port, function() {
            log.info('listening on *: ' + port);
            readyState.websocket = true;
        });
    } catch (err) {
        log.fatal("!!!!!!!!!!!!!!!");
        log.fatal("init failed with err %s", err);
        log.fatal("Terminating now");
        log.fatal("!!!!!!!!!!!!!!!");
        process.exit(42);
    }
});