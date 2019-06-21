export class Track {
    id: string;
    name: string;
    artist: string;
    year: string;
    // tslint:disable-next-line:variable-name
    image_url; string;
    // tslint:disable-next-line:variable-name
    duration_ms: number;
    preview: string;
}

export class TrackDTO {
    id: string;
    name: string;
    artist: string;
    year: string;
    // tslint:disable-next-line:variable-name
    image_url; string;
    // tslint:disable-next-line:variable-name
    duration_ms: number;
    preview: string;
    addedBy: string;
}
