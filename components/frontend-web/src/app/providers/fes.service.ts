import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';



@Injectable({
    providedIn: 'root'
})
export class FEService {

    private _SPOTIFY_URL = 'http://dev.opendj.io/api/provider-spotify/v1';

    constructor(public http: HttpClient) {}

    searchTracks(queryString): any {
        return this.http.get(`${this._SPOTIFY_URL}/searchTrack?event=4711&q=` + queryString);
    }

}
