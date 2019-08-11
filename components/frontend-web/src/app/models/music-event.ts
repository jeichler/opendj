import { Track } from 'src/app/models/track';

export class MusicEvent {
    eventID: string;
    url: string;
    name: string;
    owner: string;
    maxUsers: number;
    maxDurationInMinutes: number;
    maxTracksInPlaylist: number;
    eventStartsAt: Date;
    eventEndsAt: Date;
    allowDuplicateTracks: boolean;
    progressPercentageRequiredForEffectivePlaylist: number;
    beginPlaybackAtEventStart: boolean;
    everybodyIsCurator: boolean;
    pauseOnPlayError: boolean;
    enableTrackLiking: boolean;
    enableTrackHating: boolean;
    demoAutoskip: number;
    demoNoActualPlaying: boolean;
    demoAutoFillEmptyPlaylist: boolean;
    providers: Array<string>;
    activePlaylist: number;
//    playlists: [0];
    effectivePlaylist: Array<Track>;
}
