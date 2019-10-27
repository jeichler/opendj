
import { Track } from './../models/track';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { query } from '@angular/core/src/render3';
import { ConfigService } from './config.service';
import { retry, catchError } from 'rxjs/operators';
import { MusicEvent } from '../models/music-event';

@Injectable({
    providedIn: 'root'
})
export class FEService {

    private SPOTIFY_PROVIDER_API;
    private PLAYLIST_PROVIDER_API;
    private EMPTY_TRACK_RESULT: Observable<Track[]> = new Observable();

    constructor(public http: HttpClient, public confService: ConfigService) {
        console.debug('FEService constructor');
        this.SPOTIFY_PROVIDER_API = this.confService.SPOTIFY_PROVIDER_API;
        this.PLAYLIST_PROVIDER_API = this.confService.PLAYLIST_PROVIDER_API;
    }

    handleError(error) {
        console.error('FEService: handleError', error);
        let errorMessage = '';
        if (error.error instanceof ErrorEvent) {
          // client-side error
          errorMessage = `Error: ${error.error.message}`;
        } else {
            // server-side error
            if (error.error && error.error.code && error.error.msg) {
                errorMessage = `Error Code: ${error.error.code}\nMessage: ${error.error.msg}`;
            } else {
                if (error.error instanceof Array) {

                    errorMessage = 'Sorry:\n';
                    error.error.forEach(err => {
                        errorMessage = errorMessage + err.msg + '\n';
                    });
                } else {
                    errorMessage = 'Unexpected shit happened - Sorry for that!\n' + JSON.stringify(error);
                }
            }
        }
        window.alert(errorMessage);
        return throwError(errorMessage);
      }

      getCurrentPlaylist(event: MusicEvent): Observable<any> {
        if (!event || !event.eventID) {
            this.handleError('getCurrentPlaylist(): no event?!');
        }
        return this.http.get(this.PLAYLIST_PROVIDER_API
                                + '/events/' + event.eventID + '/playlists/' + event.activePlaylist)
            .pipe(
                retry(1),
                catchError(this.handleError)
          );
    }

    searchTracks(event: MusicEvent, queryString: string): Observable<Track[]> {
        // console.log(`qs: ${queryString}`)
        if (queryString === null || queryString === undefined || queryString.length < 2) {
            // This is not an actually error, but expectec behavior.
            // throw new Error('Required parameter queryString was null or undefined or < 2 letters.');
            // If this criteria is not met, we return an empty result:
            return this.EMPTY_TRACK_RESULT;
        }

        return this.http.get<Track[]>(this.SPOTIFY_PROVIDER_API + '/events/' + event.eventID + '/providers/spotify/search?q=' + encodeURIComponent(queryString)).pipe(
            retry(1),
            catchError(this.handleError)
          );
    }

    addTrack(event: MusicEvent, trackId: string, musicProvider: string, addedBy: string): Observable<any> {

        if (trackId === null || trackId === undefined || musicProvider === null || musicProvider === undefined || addedBy === null || addedBy === undefined) {
            throw new Error('Required parameter track was null or undefined when calling addTrack.');
        }
        return this.http.post<any>(this.PLAYLIST_PROVIDER_API
                                    + '/events/' + event.eventID
                                    + '/playlists/' + event.activePlaylist
                                    + '/tracks', { provider: musicProvider, id: trackId, user: addedBy }
                ).pipe(
                    retry(1),
                    catchError(this.handleError)
          );
    }

    deleteTrack(event: MusicEvent, trackId: string, index: string): Observable<any> {
        if (trackId === null || trackId === undefined || index === null || index === undefined) {
            throw new Error('Required parameter trackId was null or undefined when calling deleteTrack.');
        }
        return this.http.delete(this.PLAYLIST_PROVIDER_API
                                + '/events/' + event.eventID + '/playlists/' + event.activePlaylist
                                + '/tracks/' + encodeURIComponent(`spotify:${trackId}`)
                                + '?index=' + encodeURIComponent('' + index))
            .pipe(
                retry(1),
                catchError(this.handleError)
          );
        // return this.http.delete(this.PLAYLIST_PROVIDER_API + '/events/'+event.eventID+'/playlists/'+event.activePlaylist+'/tracks/' + encodeURIComponent(`spotify:${trackId}`));
    }

    reorderTrack(event: MusicEvent, trackId: string, fromIndex: number, toIndex: number): Observable<any> {
        if (trackId === null || trackId === undefined || fromIndex === null || fromIndex === undefined || toIndex === null || toIndex === undefined) {
            throw new Error('Required parameter track was null or undefined when calling addTrack.');
        }
        return this.http.post(this.PLAYLIST_PROVIDER_API
                                + '/events/' + event.eventID + '/playlists/' + event.activePlaylist
                                + '/reorder', { from: fromIndex, to: toIndex, id: trackId, provider: 'spotify' })
            .pipe(
                retry(1),
                catchError(this.handleError)
          );
    }

    playTrack(event: MusicEvent): Observable<any> {
        return this.http.get(this.PLAYLIST_PROVIDER_API + '/events/' + event.eventID + '/playlists/' + event.activePlaylist + '/play', {}).pipe(
            retry(1),
            catchError(this.handleError)
          );
    }

    pauseTrack(event: MusicEvent): Observable<any> {
        return this.http.get(this.PLAYLIST_PROVIDER_API + '/events/' + event.eventID + '/playlists/' + event.activePlaylist + '/pause', {}).pipe(
            retry(1),
            catchError(this.handleError)
          );
    }

    playNextTrack(event: MusicEvent): Observable<any> {
        return this.http.get(this.PLAYLIST_PROVIDER_API + '/events/' + event.eventID + '/playlists/' + event.activePlaylist + '/next', {}).pipe(
            retry(1),
            catchError(this.handleError)
          );
    }

    deletePlaylist(event: MusicEvent, playlistId: string): Observable<any> {
        if (playlistId === null || playlistId === undefined) {
            throw new Error('Required parameter playlistId was null or undefined when calling deletePlaylist.');
        }
        return this.http.delete(this.PLAYLIST_PROVIDER_API + '/events/' + event.eventID + '/playlists/' + encodeURIComponent(playlistId)).pipe(
            retry(1),
            catchError(this.handleError)
          );
    }

    /* ------------------------------------------------------------------------ */
    /* ------------------------------------------------------------------------ */
    /* ------------------------- CRUD Event ----------------------------------- */
    /* ------------------------------------------------------------------------ */
    /* ------------------------------------------------------------------------ */

    createEvent(event: MusicEvent): Observable<MusicEvent> {
        return this.http.post<MusicEvent>(this.PLAYLIST_PROVIDER_API + '/events', event).pipe(
            retry(1),
            catchError(this.handleError)
          );
    }

    readEvent(eventID: string): Observable<MusicEvent> {
        if (!eventID) {
            eventID = '___prototype___';
        }

        return this.http.get<MusicEvent>(this.PLAYLIST_PROVIDER_API + '/events/' + eventID, {}).pipe(
            retry(1),
            catchError(this.handleError)
          );
    }

    updateEvent(event: MusicEvent): Observable<MusicEvent> {
        return this.http.post<MusicEvent>(this.PLAYLIST_PROVIDER_API + '/events/' + event.eventID, event).pipe(
            retry(1),
            catchError(this.handleError)
          );
    }

    deleteEvent(eventID: string): Observable<MusicEvent> {
        return this.http.delete<MusicEvent>(this.PLAYLIST_PROVIDER_API + '/events/' + eventID).pipe(
            retry(1),
            catchError(this.handleError)
          );
    }

    validateEvent(event: MusicEvent): Observable<MusicEvent> {
        console.debug('fes-service validateEvent %s - prov=%s', event.eventID, this.PLAYLIST_PROVIDER_API);
        return this.http.post<MusicEvent>(this.PLAYLIST_PROVIDER_API + '/events/' + event.eventID + '/validate', event).pipe(
            retry(1),
            catchError(this.handleError)
          );

    }










}
