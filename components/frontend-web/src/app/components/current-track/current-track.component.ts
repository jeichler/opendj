import { FEService } from './../../providers/fes.service';
import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { Track } from 'src/app/models/track';
import { MusicEvent } from 'src/app/models/music-event';
import { Platform } from '@ionic/angular';

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
//    console.debug('trackInput()', value);
    if (this.intervalHandle) {
//      console.debug('clear interval');
      clearInterval(this.intervalHandle);
    }
    if (value == null) {
//      console.debug('no track as input');
      value = this.emptyTrack;
      this.currentTime = '--:--';
      this.playingTime = '--:--';
    }

    this.track = value;
    this.progress = this.track.progress_ms / 1000;

    if (this.isPlaying) {
      const now = new Date().getTime() / 1000;
      const startedAt = new Date(this.track.started_at).getTime() / 1000;
      const diff = (now - startedAt);
      this.progress = diff;
      this.intervalHandle = setInterval(() => this.countdown(), 500);
    } else {
      this.track.started_at =  new Date().toISOString();
      this.countdown();
    }
  }
  @Input() set currentEventInput(event: MusicEvent) {
    this.currentEvent = event;
  }

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
    this.progress  = (Date.now() - Date.parse(this.track.started_at));
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
    // console.debug("timeRemaining=%s", this.timeRemaining);

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
    this.feService.playTrack(this.currentEvent).subscribe(data => {
      console.debug(data);
    });
  }

  pauseTrack() {
    this.feService.pauseTrack(this.currentEvent).subscribe(data => {
      console.debug(data);
    });
  }

  nextTrack() {
    this.feService.playNextTrack(this.currentEvent).subscribe(data => {
      console.debug(data);
    });
  }

  ngOnInit() {
//    console.debug('current-track-componentn-ngOnInit', this.track);
  }

  ngOnDestroy() {
    clearInterval(this.intervalHandle);
  }


}
