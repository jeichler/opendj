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
    init() {
        this.socket = io(this.confService.websocketHost, {
            reconnectionAttempts: Infinity,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            randomizationFactor: 0.5,
            timeout: 20000,
            path: this.confService.websocketPath
        });
    }

    getPlaylist() {
        const observable = new Observable(observer => {
            this.socket.on('current-playlist', (data) => {
                console.debug('WebsocketService: Received playlist update');
                observer.next(data);
            });
        });
        return observable;
    }

    refreshPlaylist() {
        console.debug("refreshPlaylist");
        this.socket.emit('refresh-playlist');
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
