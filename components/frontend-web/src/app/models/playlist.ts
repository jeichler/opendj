import { Track } from './track';

export class Playlist {
    playlistID: number;
    isPlaying: boolean;
    currentTrack: any;
    nextTracks: Track[] = [];
}
