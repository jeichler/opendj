import { Injectable } from '@angular/core';


@Injectable({
  providedIn: 'root'
})
export class EnvService {

  // The values that are defined here are the default values that can
  // be overridden by env.js

  public enableDebug = true;
  public curatorPassword = '';
  public playlistMaxSize = 10;
  public websocketUrl = '';

  public SPOTIFY_PROVIDER_API = '';
  public PLAYLIST_PROVIDER_API = '';

  constructor() { }
}
