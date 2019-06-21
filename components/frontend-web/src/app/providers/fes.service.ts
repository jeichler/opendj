import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';



@Injectable({
    providedIn: 'root'
})
export class FEService {

    SPOTIFY_PROVIDER_API =  'http://dev.opendj.io/api/provider-spotify/v1';

    constructor(public http: HttpClient) {}

    searchTracks(queryString): any {
        return this.http.get(this.SPOTIFY_PROVIDER_API + '/searchTrack?event=4711&q=' + queryString);
    }

}
