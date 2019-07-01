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

    init() {
        this.socket = io(this.confService.websocketHost, {
            reconnectionAttempts: 10,
            path: this.confService.websocketPath
        });
    }

    getPlaylist() {
        const observable = new Observable(observer => {
            this.socket.on('current-playlist', (data) => {
                console.log('WebsocketService: Received playlist update');
                observer.next(data);
            });
        });
        return observable;
    }

    refreshPlaylist() {
        this.socket.emit('refresh-playlist');
    }

    isConnected() {
        return this.socket.connected;
    }

    disconnect() {
        console.log('WebsocketService: disconnect');
        return this.socket.disconnect();
    }

    connect() {
        console.log('WebsocketService: connect');
        return this.socket.connect();
    }

}
