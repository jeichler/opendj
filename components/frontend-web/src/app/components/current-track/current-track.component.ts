import { FEService } from './../../providers/fes.service';
import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { Track } from 'src/app/models/track';
import { MusicEvent } from 'src/app/models/music-event';
import { Platform } from '@ionic/angular';
import { Playlist } from 'src/app/models/playlist';
import { UserDataService } from 'src/app/providers/user-data.service';
import { UserSessionState } from 'src/app/models/usersessionstate';

@Component({
  selector: 'app-current-track',
  templateUrl: './current-track.component.html',
  styleUrls: ['./current-track.component.scss'],
  providers: [ FEService ]
})
export class CurrentTrackComponent implements OnInit, OnDestroy {


  @Input() isCurator: boolean;
  @Input() isPlaying: boolean;
  @Input() set trackInput(value: any) {
    this.setTrack(value);
  }

  @Input() set currentEventInput(event: MusicEvent) {
    this.currentEvent = event;
  }
  @Input() user: UserSessionState;

  emptyTrack = {
    name: '---',
    artist: 'No current track',
    added_by: '---',
    image_url: 'assets/img/Logo_OpenDJ_128.png',
    image_url_ref: '',
    numLikes: 0,
    numHates: 0,
    progress_ms: 0,
    duration_ms: 0,
    genre: '---',
    year: '---',
    bpm: 0,
    isPlaying: false,
    started_at: new Date().toISOString(),
    danceability: 0,
    energy: 0,
    happiness: 0,
    isEmptyTrack: true
  };

  track = (this.emptyTrack) as unknown as Track;
  timeRemaining = 0; // progressbar value
  currentTime = '--:--'; // remaining playtime
  playingTime = '--:--'; // played time
  totalTime = null; // total track length
  progress; // temp var for countdown
  intervalHandle = null;
  currentEvent: MusicEvent;

  constructor(
    public feService: FEService,
    public platform: Platform ) {
  }
  setTrack(value: Track) {
    console.debug('begin setTrack', value);
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }
    if (value == null) {
      value = this.emptyTrack as any as Track;
      this.currentTime = '--:--';
      this.playingTime = '--:--';
    }

    this.track = value;

    if (this.isPlaying) {
      this.intervalHandle = setInterval(() => this.countdown(), 500);
    } else {
      if (this.intervalHandle) {
        clearInterval(this.intervalHandle);
        this.intervalHandle = null;
      }
    }
    this.countdown();
  }

  calculateTotalTime() {
    const duration = this.track.duration_ms / 1000;
    let s = duration % 60;
    const m = Math.floor(duration / 60) % 60;
    s = Math.round(s);
    const sStr = s < 10 ? '0' + s : '' + s;
    const mStr = m < 10 ? '0' + m : '' + m;
    this.totalTime = mStr + ':' + sStr;
  }

  countdown() {
    const duration = this.track.duration_ms;
    if (this.isPlaying) {
      this.progress  = (Date.now() - Date.parse(this.track.started_at));
    } else {
        this.progress = this.track.progress_ms;
    }

    if (this.progress < 0) {
      this.progress = 0;
    }
    // Fix issue#156: when track has ended but no new track is
    // received from server, stop counting:
    if (this.progress > duration) {
      this.progress = duration;
    }

    let timeLeft = duration - this.progress;
    if (timeLeft < 0) {
      timeLeft = 0;
    }


    this.timeRemaining = 1 - (timeLeft / duration);
    this.timeRemaining = Math.floor(this.timeRemaining * 1000) / 1000;
//    console.debug('timeRemaining=%s progress=%s duration=%s', this.timeRemaining, this.progress, duration);

    let s = timeLeft / 1000 % 60;
    s = Math.floor(s);
    const m = Math.floor(timeLeft / 1000 / 60) % 60;
    const sStr = s < 10 ? '0' + s : '' + s;
    const mStr = m < 10 ? '0' + m : '' + m;
    this.currentTime = '- ' + mStr + ':' + sStr;

    const mP = Math.floor(this.progress / 1000 / 60);
    let sP = this.progress / 1000 % 60;
    sP = s = Math.floor(sP);
    const spStr = sP < 10 ? '0' + sP : '' + sP;
    const mpStr = mP < 10 ? '0' + mP : '' + mP;
    this.playingTime = mpStr + ':' + spStr;
  }

  playTrack() {
    console.debug('playTrack()');
    this.feService.playTrack(this.currentEvent, this.user).subscribe(data => {
      console.debug('current-track - playTrackResponse', data);
      this.isPlaying = data.isPlaying;
      this.setTrack(data.currentTrack);
    });
  }

  pauseTrack() {
    console.debug('pauseTrack()');
    this.feService.pauseTrack(this.currentEvent, this.user).subscribe(data => {
      console.debug('current-track - pauseTrackResponse', data);
      this.isPlaying = data.isPlaying;
      this.setTrack(data.currentTrack);
    });
  }

  nextTrack() {
    console.debug('nextTrack()');
    this.feService.playNextTrack(this.currentEvent, this.user).subscribe(data => {
      console.debug('current-track - nextTrack', data);
      this.isPlaying = data.isPlaying;
      this.setTrack(data.currentTrack);
    });
  }

  volumeDown() {
    console.debug('vol down');
    this.feService.decreaseSpotifyVolume(this.currentEvent).subscribe(data => {
      console.debug('vol down ok');
    });
  }
  volumeUp() {
    console.debug('vol up');
    this.feService.increaseSpotifyVolume(this.currentEvent).subscribe(data => {
      console.debug('vol up ok');
    });
  }

  ngOnInit() {
    console.debug('current-track-component-ngOnInit', this.track);
    this.setTrack(this.track);
  }

  ngOnDestroy() {
    clearInterval(this.intervalHandle);
  }


}
