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
    eventStartsAt: string; // ISO DateTime as String
    eventEndsAt: string; // ISO DateTime as String
    allowDuplicateTracks: boolean;
    progressPercentageRequiredForEffectivePlaylist: number;
    beginPlaybackAtEventStart: boolean;
    everybodyIsCurator: boolean;
    pauseOnPlayError: boolean;
    enableTrackLiking: boolean;
    emojiTrackLike: string;
    emojiTrackHate: string;
    enableTrackHating: boolean;
    enableTrackAI: boolean;
    demoAutoskip: number;
    demoNoActualPlaying: boolean;
    demoAutoFillEmptyPlaylist: boolean;
    providers: Array<string>;
    activePlaylist = 0;
    playlists: [0];
    effectivePlaylist: Array<Track>;

    eventViewAutoScroll = false;
    eventViewAutoScrollSpeed = 1;
    eventViewTwitterUrl: string = null;
}
