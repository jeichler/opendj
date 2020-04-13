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
    enableTrackAutoMove: boolean;
    enableTrackAI: boolean;
    enableTrackHateSkip: boolean;
    enableCurrentTrackHateSkip: boolean;
    demoAutoskip: number;
    demoNoActualPlaying: boolean;
    demoAutoFillEmptyPlaylist: boolean;
    demoAutoFillNumTracks: number;
    demoAutoFillFromPlaylist: string;
    providerTypes: Array<string>;
    providers: Array<MusicProvider>;
    usersCanAddProvider: boolean;
    activePlaylist = 0;
    playlists: [0];
    effectivePlaylist: Array<Track>;

    eventViewEnable: boolean;
    eventViewPassword: string;
 /*   NO_AUTOSCROLL#264
    eventViewAutoScrollEnable: boolean;
    eventViewAutoScrollInterval: number;
    eventViewAutoScrollSpeed: number;
    eventViewAutoScrollTopOnNext: boolean;
*/
    eventViewShowMetaBars: boolean;
    eventViewShowActivityFeed: boolean;
    eventViewShowStats: boolean;

    eventViewTwitterURL: string;

    fitTrackWeightBPM: number;
    fitTrackWeightYear: number;
    fitTrackWeightGenre: number;

    autoMoveWeightLike: number;
    autoMoveWeightHate: number;

    skipCurrentTrackQuorum: number;
    skipCurrentTrackHatePercentage: number;
}

export class EventStats {
    numUsers: number;
    numUsersOnline: number;
    maxUsers: number;
    maxUsersOnline: number;
    numCurators: number;
    numCuratorsOnline: number;
    numTracksPlayed: number;
}

export class MusicProvider {
    type: string;
    id: string;
    display: string;
    user: string;
    email: string;
    // tslint:disable-next-line:variable-name
    image_url: string;
}
