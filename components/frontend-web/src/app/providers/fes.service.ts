import { Track } from './../models/track';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { EnvService } from './env.service';



@Injectable({
    providedIn: 'root'
})
export class FEService {

    private SPOTIFY_PROVIDER_API;
    private PLAYLIST_PROVIDER_API;

    constructor( public http: HttpClient, public envService: EnvService ) {
        this.SPOTIFY_PROVIDER_API = this.envService.SPOTIFY_PROVIDER_API;
        this.PLAYLIST_PROVIDER_API = this.envService.SPOTIFY_PROVIDER_API;
    }

    searchTracks(queryString: string): Observable<Track[]> {
        if (queryString === null || queryString === undefined || queryString.length < 2 ) {
            throw new Error('Required parameter queryString was null or undefined or < 2 letters.');
        }
        return this.http.get<Track[]>(this.SPOTIFY_PROVIDER_API + '/searchTrack?event=4711&q=' + encodeURIComponent(queryString));
    }

    addTrack(trackId: string, musicProvider: string, addedBy: string): Observable<any> {

        if ( trackId === null || trackId === undefined || musicProvider === null || musicProvider === undefined || addedBy === null || addedBy === undefined ) {
            throw new Error('Required parameter track was null or undefined when calling addTrack.');
        }
        return this.http.post(this.PLAYLIST_PROVIDER_API + '/events/0/playlists/0/tracks', { provider: musicProvider, id: trackId, user: addedBy });
    }

    deleteTrack(trackId: string, index: number): Observable<any> {
        if (trackId === null || trackId === undefined || index === null || index === undefined) {
            throw new Error('Required parameter trackId was null or undefined when calling deleteTrack.');
        }
        return this.http.delete(this.PLAYLIST_PROVIDER_API + '/events/0/playlists/0/tracks/' + encodeURIComponent(trackId) + '?index=' + encodeURIComponent(index));
    }

    reorderTrack(trackId: string, fromIndex: number, toIndex: number): Observable<any> {
        if (trackId === null || trackId === undefined || fromIndex === null || fromIndex === undefined || toIndex === null || toIndex === undefined) {
            throw new Error('Required parameter track was null or undefined when calling addTrack.');
        }
        return this.http.put(this.PLAYLIST_PROVIDER_API + '/events/0/playlists/0/reorder', { from: fromIndex, to: toIndex, id: trackId });
    }

    playTrack(): Observable<any> {
        return this.http.put(this.PLAYLIST_PROVIDER_API + '/events/0/playlists/0/play', {});
    }

    pauseTrack(): Observable<any> {
        return this.http.put(this.PLAYLIST_PROVIDER_API + '/events/0/playlists/0/pause', {});
    }

    playNextTrack(): Observable<any> {
        return this.http.put(this.PLAYLIST_PROVIDER_API + '/events/0/playlists/0/next', {});
    }

    deletePlaylist(playlistId: string): Observable<any> {
        if (playlistId === null || playlistId === undefined) {
            throw new Error('Required parameter playlistId was null or undefined when calling deletePlaylist.');
        }
        return this.http.delete(this.PLAYLIST_PROVIDER_API + '/events/0/playlists/' + encodeURIComponent(playlistId));
    }

}
