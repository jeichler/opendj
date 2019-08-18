import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { of, Observable } from 'rxjs';
import { map } from 'rxjs/operators';


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

    constructor(public http: HttpClient) {
        console.debug("begin ConfigService constructor");
    }

    async loadConfigurationData() {
        console.debug("begin ConfigService loadConfigurationData");

        let data = await this.http.get<any>('conf/config.json').toPromise();

        console.info('App config loaded: ' + JSON.stringify(data));
        this.enableDebug = data.enableDebug;
        this.curatorPassword = data.curatorPassword;
        this.playlistMaxSize = data.playlistMaxSize;
        this.websocketHost = data.websocketHost;
        this.websocketPath = data.websocketPath;
        this.SPOTIFY_PROVIDER_API = data.SPOTIFY_PROVIDER_API;
        this.PLAYLIST_PROVIDER_API = data.PLAYLIST_PROVIDER_API;


 /*       
        this.http.get<any>('conf/config.json').subscribe(data => {
            console.info('App config loaded: ' + JSON.stringify(data));
            this.enableDebug = data.enableDebug;
            this.curatorPassword = data.curatorPassword;
            this.playlistMaxSize = data.playlistMaxSize;
            this.websocketHost = data.websocketHost;
            this.websocketPath = data.websocketPath;
            this.SPOTIFY_PROVIDER_API = data.SPOTIFY_PROVIDER_API;
            this.PLAYLIST_PROVIDER_API = data.PLAYLIST_PROVIDER_API;
        });
*/        
        console.debug("end ConfigService loadConfigurationData");
    }

}
