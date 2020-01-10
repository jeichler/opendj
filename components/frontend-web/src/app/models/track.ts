export class Track {
    id: string;
    name: string;
    artist: string;
    year: number;
    // tslint:disable-next-line:variable-name
    image_url: string;
    // tslint:disable-next-line:variable-name
    image_url_ref: string;
    // tslint:disable-next-line:variable-name
    duration_ms: number;
    preview: string;
    previewViaApp: string;
    provider: string;
    popularity: number;
    genre: string;
    genreSimple: string;
    genreMap: GenreMap;
    danceability: number;
    energy: number;
    acousticness: number;
    instrumentalness: number;
    liveness: number;
    happiness: number;
    bpm: number;
    // tslint:disable-next-line:variable-name
    added_by: string;

    numLikes = 0;
    numHates = 0;

    // Client side only attributes:
    eta: string;
    durationStr: string;
    // tslint:disable-next-line:variable-name
    started_at: string;
    // tslint:disable-next-line:variable-name
    progress_ms: number;
    isEmptyTrack: false;
    pos: number;
}

export class GenreMap {
        x: number;
        y: number;
        w: number;
}
