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
    maxContributionsPerUser: number;
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
    demoAutoFillNumTracks: number;
    providers: Array<string>;
    activePlaylist = 0;
    playlists: [0];
    effectivePlaylist: Array<Track>;

    eventViewEnable: boolean;
    eventViewPassword: string;
    eventViewAutoScrollEnable: boolean;
    eventViewAutoScrollInterval: number;
    eventViewAutoScrollSpeed: number;
    eventViewAutoScrollTopOnNext: boolean;
    eventViewShowMetaBars: boolean;
    eventViewShowActivityFeed: boolean;

    eventViewTwitterURL: string;
}
