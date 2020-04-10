import { Injectable } from '@angular/core';
import * as io from 'socket.io-client';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';
import { UserSessionState } from '../models/usersessionstate';

@Injectable()
export class WebsocketService {

    // Our socket connection
    private socket = null;

    constructor(private confService: ConfigService) {
        console.debug('constructor');

    }

// TODO: Add "query" parameter with event ID to be received by server:
    init(eventID: string, user: UserSessionState) {
        console.debug('init ws -> eventID=%s', eventID);

        // Use /event/<EventID> as socket.io Namespace, which must be added to host parameter:
        const hostStr = this.confService.websocketHost + '/event/' + eventID;
        const pathStr = this.confService.websocketPath;
        console.debug('create ws host=%s, path=%s', hostStr, pathStr);

        this.socket = io(hostStr, {
            reconnectionAttempts: Infinity,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            randomizationFactor: 0.5,
            timeout: this.confService.SERVER_TIMEOUT,
            path: pathStr,
            query: {
                user: user.username
            }
        });

        this.socket.on('connect', (socket) => {
            console.debug('ws connected established!');
// No need to request refresh - will be sent by server as welcome package:
//            console.debug('connected! - request refreshPlaylist');
//            this.refreshPlaylist();
        });

        console.debug('init(): connect');
        this.connect();
    }

    observePlaylist() {
        console.debug('observePlaylist');
        const observable = new Observable(observer => {
            this.socket.on('current-playlist', (data) => {
                console.debug('observePlaylist -> Received playlist update');
                observer.next(data);
            });
        });
        return observable;
    }

    observeEvent() {
        console.debug('observeEvent');
        const observable = new Observable(observer => {
            this.socket.on('current-event', (data) => {
                console.debug('observeEvent -> Received event update');
                observer.next(data);
            });
        });
        return observable;
    }

    observeActivity() {
        console.debug('observeActivity');
        const observable = new Observable(observer => {
            this.socket.on('event-activity', (data) => {
                console.debug('observeActivity -> Received activity');
                observer.next(data);
            });
        });
        return observable;
    }


    refreshPlaylist() {
        console.debug('refreshPlaylist');
        this.socket.emit('refresh-playlist');
    }

    isConnected() {
        return this.socket!=null && this.socket.connected;
    }

    disconnect() {
        console.info('disconnect');
        return this.socket.disconnect();
    }

    connect() {
        console.info('connect');
        return this.socket.connect();
    }

}
