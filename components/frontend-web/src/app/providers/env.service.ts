import { Injectable } from '@angular/core';


@Injectable({
  providedIn: 'root'
})
export class EnvService {

  // The values that are defined here are the default values that can
  // be overridden by env.js

  public enableDebug = true;
  public curatorPassword = 'test';
  public playlistMaxSize = 50;
  public websocketHost = 'http://dev.opendj.io';
  public websocketPath = '/api/service-web/socket';

  public SPOTIFY_PROVIDER_API = 'http://dev.opendj.io/api/provider-spotify/v1';
  public PLAYLIST_PROVIDER_API = 'http://dev.opendj.io/api/service-playlist/v1';

  constructor() { }
}
