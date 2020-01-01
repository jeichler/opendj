import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';


@Injectable({
    providedIn: 'root'
})
export class ConfigService {

    enableDebug;
    curatorPassword;
    playlistMaxSize;
    websocketHost;
    websocketPath;
    SPOTIFY_PROVIDER_API;
    PLAYLIST_PROVIDER_API;
    WEB_PROVIDER_API;
    SERVER_TIMEOUT = 1000;

    constructor(public http: HttpClient) {}

    async loadConfigurationData() {
        console.debug('loadConfigurationData');

        const data = await this.http.get<any>('conf/config.json').toPromise();

        console.debug('App config loaded: ' + JSON.stringify(data));
        this.enableDebug = data.enableDebug;
        this.curatorPassword = data.curatorPassword;
        this.playlistMaxSize = data.playlistMaxSize;
        this.websocketHost = data.websocketHost;
        this.websocketPath = data.websocketPath;
        this.WEB_PROVIDER_API = data.WEB_PROVIDER_API;
        this.SPOTIFY_PROVIDER_API = data.SPOTIFY_PROVIDER_API;
        this.PLAYLIST_PROVIDER_API = data.PLAYLIST_PROVIDER_API;
        this.SERVER_TIMEOUT = data.SERVER_TIMEOUT;
    }

}
