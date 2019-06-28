import { Injectable } from '@angular/core';
import * as io from 'socket.io-client';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

@Injectable()
export class WebsocketService {

    // Our socket connection
    private socket;

    constructor(private confService: ConfigService) {
        this.socket = io(confService.websocketHost, {
            reconnectionAttempts: 10,
            path: confService.websocketPath
        });
    }

    getPlaylist() {
        const observable = new Observable(observer => {
            this.socket.on('current-playlist', (data) => {
                console.log('Received playlist update from Websocket Server');
                observer.next(data);
            });
        });
        return observable;
    }

    isConnected() {
        return this.socket.connected;
    }

    disconnect() {
        return this.socket.disconnect();
    }

    connect() {
        return this.socket.connect();
    }

}
