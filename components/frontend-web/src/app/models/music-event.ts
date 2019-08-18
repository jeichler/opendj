import { Track } from 'src/app/models/track';

export class MusicEvent {
    eventID: string;
    url: string;
    name: string;
    owner: string;
    passwordOwner: string;
    passwordCurator: string;
    passwordUser: string;
    maxUsers: number;
    maxDurationInMinutes: number;
    maxTracksInPlaylist: number;
    eventStartsAt: String; // ISO DateTime as String
    eventEndsAt: String; // ISO DateTime as String
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
    activePlaylist: number = 0;
    playlists: [0];
    effectivePlaylist: Array<Track>;
}
