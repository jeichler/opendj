import { Injectable } from '@angular/core';
import * as io from 'socket.io-client';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

@Injectable()
export class WebsocketService {

    // Our socket connection
    private socket = null;

    constructor(private confService: ConfigService) {
    }

// TODO: Add "query" parameter with event ID to be received by server:
    init(eventID: string) {
        console.debug('begin websocket init eventID=%s', eventID);

        // Use /event/<EventID> as socket.io Namespace, which must be added to host parameter:
        const hostStr = this.confService.websocketHost + '/event/' + eventID;
        const pathStr = this.confService.websocketPath;
        console.debug('connect to websocket host=%s, path=%s', hostStr, pathStr);

        this.socket = io(hostStr, {
            reconnectionAttempts: Infinity,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            randomizationFactor: 0.5,
            timeout: 20000,
            path: pathStr
        });
        console.debug('end websocket init eventID=%s', eventID);
    }

    observePlaylist() {
        console.debug('begin websocket observePlaylist()');
        const observable = new Observable(observer => {
            this.socket.on('current-playlist', (data) => {
                console.debug('WebsocketService: Received playlist update');
                observer.next(data);
            });
        });
        console.debug('end websocket observePlaylist()');
        return observable;
    }

    observeEvent() {
        console.debug('begin websocket observeEvent()');
        const observable = new Observable(observer => {
            this.socket.on('current-event', (data) => {
                console.debug('WebsocketService: Received event update');
                observer.next(data);
            });
        });
        console.debug('end websocket observeEvent()');
        return observable;
    }



    refreshPlaylist() {
        console.debug('begin websocket refreshPlaylist()');
        this.socket.emit('refresh-playlist');
        console.debug('end websocket refreshPlaylist()');
    }

    isConnected() {
        return this.socket.connected;
    }

    disconnect() {
        console.info('WebsocketService: disconnect');
        return this.socket.disconnect();
    }

    connect() {
        console.info('WebsocketService: connect');
        return this.socket.connect();
    }

}
