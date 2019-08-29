import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';


@Injectable({
    providedIn: 'root'
})
export class MockService {

    constructor(public http: HttpClient) {}

    getEvents(): any {
        return this.http.get('assets/data/events.json');
    }

}
