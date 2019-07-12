
import { Track } from './../models/track';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { query } from '@angular/core/src/render3';
import { ConfigService } from './config.service';
import { retry, catchError } from 'rxjs/operators';



@Injectable({
    providedIn: 'root'
})
export class FEService {

    private SPOTIFY_PROVIDER_API;
    private PLAYLIST_PROVIDER_API;
    private EMPTY_TRACK_RESULT : Observable<Track[]> = new Observable();

    constructor(public http: HttpClient, public confService: ConfigService) {
        console.info(this.confService.SPOTIFY_PROVIDER_API);
        this.SPOTIFY_PROVIDER_API = this.confService.SPOTIFY_PROVIDER_API;
        this.PLAYLIST_PROVIDER_API = this.confService.PLAYLIST_PROVIDER_API;
    }

    handleError(error) {
        let errorMessage = '';
        if (error.error instanceof ErrorEvent) {
          // client-side error
          errorMessage = `Error: ${error.error.message}`;
        } else {
          // server-side error
          errorMessage = `Error Code: ${error.error.code}\nMessage: ${error.error.msg}`;
        }
        window.alert(errorMessage);
        return throwError(errorMessage);
      }

    searchTracks(queryString: string): Observable<Track[]> {
        // console.log(`qs: ${queryString}`)
        if (queryString === null || queryString === undefined || queryString.length < 2) {
            // throw new Error('Required parameter queryString was null or undefined or < 2 letters.');
            return this.EMPTY_TRACK_RESULT;
        }
        return this.http.get<Track[]>(this.SPOTIFY_PROVIDER_API + '/searchTrack?event=0&q=' + encodeURIComponent(queryString)).pipe(
            retry(1),
            catchError(this.handleError)
          );
    }

    addTrack(trackId: string, musicProvider: string, addedBy: string): Observable<any> {

        if (trackId === null || trackId === undefined || musicProvider === null || musicProvider === undefined || addedBy === null || addedBy === undefined) {
            throw new Error('Required parameter track was null or undefined when calling addTrack.');
        }
        return this.http.post<any>(this.PLAYLIST_PROVIDER_API + '/events/0/playlists/0/tracks', { provider: musicProvider, id: trackId, user: addedBy }).pipe(
            retry(1),
            catchError(this.handleError)
          );
    }

    deleteTrack(trackId: string, index: string): Observable<any> {
        if (trackId === null || trackId === undefined || index === null || index === undefined) {
            throw new Error('Required parameter trackId was null or undefined when calling deleteTrack.');
        }
        return this.http.delete(this.PLAYLIST_PROVIDER_API + '/events/0/playlists/0/tracks/' + encodeURIComponent(`spotify:${trackId}`) + '?index=' + encodeURIComponent('' + index)).pipe(
            retry(1),
            catchError(this.handleError)
          );
        // return this.http.delete(this.PLAYLIST_PROVIDER_API + '/events/0/playlists/0/tracks/' + encodeURIComponent(`spotify:${trackId}`));
    }

    reorderTrack(trackId: string, fromIndex: number, toIndex: number): Observable<any> {
        if (trackId === null || trackId === undefined || fromIndex === null || fromIndex === undefined || toIndex === null || toIndex === undefined) {
            throw new Error('Required parameter track was null or undefined when calling addTrack.');
        }
        return this.http.post(this.PLAYLIST_PROVIDER_API + '/events/0/playlists/0/reorder', { from: fromIndex, to: toIndex, id: trackId, provider: 'spotify' }).pipe(
            retry(1),
            catchError(this.handleError)
          );
    }

    playTrack(): Observable<any> {
        return this.http.get(this.PLAYLIST_PROVIDER_API + '/events/0/playlists/0/play', {}).pipe(
            retry(1),
            catchError(this.handleError)
          );
    }

    pauseTrack(): Observable<any> {
        return this.http.get(this.PLAYLIST_PROVIDER_API + '/events/0/playlists/0/pause', {}).pipe(
            retry(1),
            catchError(this.handleError)
          );
    }

    playNextTrack(): Observable<any> {
        return this.http.get(this.PLAYLIST_PROVIDER_API + '/events/0/playlists/0/next', {}).pipe(
            retry(1),
            catchError(this.handleError)
          );
    }

    deletePlaylist(playlistId: string): Observable<any> {
        if (playlistId === null || playlistId === undefined) {
            throw new Error('Required parameter playlistId was null or undefined when calling deletePlaylist.');
        }
        return this.http.delete(this.PLAYLIST_PROVIDER_API + '/events/0/playlists/' + encodeURIComponent(playlistId)).pipe(
            retry(1),
            catchError(this.handleError)
          );
    }

}
