import { Injectable } from '@angular/core';
import * as io from 'socket.io-client';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';
import { UserSessionState } from '../models/usersessionstate';

@Injectable()
export class WebsocketService {

    // Our socket connection
    private socket = null;
    private eventID = null;

    constructor(private confService: ConfigService) {
        console.debug('constructor');

    }

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

        this.eventID = eventID;

        this.socket.on('connect', (socket) => {
            console.debug('ws connection established!');
        });

        console.debug('init(): connect');
        this.connect();
    }

    destroy() {
        console.debug('destroy()');
        if (this.socket != null) {
            this.socket.disconnect();
        }
        this.socket = null;
    }

    observePlaylist() {
        console.debug('observePlaylist');
        const observable = new Observable(observer => {
            this.socket.on('current-playlist', (data) => {
                console.debug('observePlaylist -> Received playlist update');
                // Sanity check before we post thew news:
                if (data.eventID === this.eventID) {
                    observer.next(data);
                } else {
                    console.error('received playlist for event %s, but we are expecting update for %s - disconnecting!', data.eventID, this.eventID);
                    this.destroy();
                }
            });
        });
        return observable;
    }

    observeEvent() {
        console.debug('observeEvent');
        const observable = new Observable(observer => {
            this.socket.on('current-event', (data) => {
                console.debug('observeEvent -> Received event update');
                // Sanity check before we post thew news:
                if (data.eventID === this.eventID) {
                    observer.next(data);
                } else {
                    console.error('received update for event %s, but we are expecting update for %s - disconnecting!', data.eventID, this.eventID);
                    this.destroy();
                }
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
        return this.socket != null && this.socket.connected;
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
