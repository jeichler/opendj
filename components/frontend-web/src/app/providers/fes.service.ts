import { Track, TrackDTO } from './../models/track';
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
        if (trackId === null || trackId === undefined) {
            throw new Error('Required parameter track was null or undefined when calling addTrack.');
        }
        // DanielF: I only need the Provider and TrackID .
        // Response is the full playlist object, as the track might not be added to the end
        // (if a future AI/ML implmentation decides to move it somewhere else).
        // But you could also ignore the resonse, as that upate of the playlist
        // will also be broadcasted via websocket:
        // And I need the user!
        // tslint:disable-next-line:max-line-length
        return this.http.post(this.PLAYLIST_PROVIDER_API + '/events/0/playlists/0/tracks', {provider: musicProvider, id: trackId, user: addedBy});
    }

    deleteTrack(trackId: string): Observable<any> {
        if (trackId === null || trackId === undefined) {
            throw new Error('Required parameter trackId was null or undefined when calling deleteTrack.');
        }
        // HEADSUP: DanielF says: trackId might not be unique here, as a track can
        // occur more then once in a single playlist, if the event owner permits duplicates.
        // So an additional ordinal position argument would be good:.
        return this.http.delete(this.PLAYLIST_PROVIDER_API + '/events/0/playlists/0/tracks/' + encodeURIComponent(trackId));
    }

    reorderTrack(fromIndex: number, toIndex: number): Observable<any> {
        if (fromIndex === null || fromIndex === undefined) {
            throw new Error('Required parameter track was null or undefined when calling addTrack.');
        }

        // TODO: DanielF says: I need not only the fromIndex, but also the trackID, because the fromIndex might have changed
        // meanwhile on the server side (imagine two concurrent edits). adding an syntax error here for ortwin to notice!
        // TODO: DanielF: GET is not suitable for a mutator, I suggest to use patch(preferred, because of MODIFY semantic),put or post here:
        return this.http.patch(this.PLAYLIST_PROVIDER_API +
            '/events/0/playlists/0/reorder', {from: fromIndex, to:toIndex, provider: "fixme", id: "fixme"} );
    }

    playTrack(trackId: string): Observable<any> {
        if (trackId === null || trackId === undefined) {
            throw new Error('Required parameter trackId was null or undefined when calling deleteTrack.');
        }
        // DanielF says: you only can start playing of the playlist, not a specific track.
        return this.http.put(this.PLAYLIST_PROVIDER_API + '/events/0/playlists/0/play', {});
    }

    pauseTrack(): Observable<any> {
        return this.http.put(this.PLAYLIST_PROVIDER_API + '/events/0/playlists/0/pause', {});
    }

 /*   DanielF says: there is no difference between "pause" and "stop". Lets make it play/pause, because sounds more like music then start/stop
    stopTrack(): Observable<any> {
        return this.http.put(this.PLAYLIST_PROVIDER_API + '/events/0/playlists/0/stop', {});
    }
*/
 
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
