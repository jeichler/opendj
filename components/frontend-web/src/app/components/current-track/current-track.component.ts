import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { Track } from 'src/app/models/track';

@Component({
  selector: 'app-current-track',
  templateUrl: './current-track.component.html',
  styleUrls: ['./current-track.component.scss'],
})
export class CurrentTrackComponent implements OnInit, OnDestroy {

  @Input() isCurator: boolean;
  @Input() set trackInput(value: any) {
    if (this.intervalHandle) {
      console.log('clear interval');
      clearInterval(this.intervalHandle);
    }
    this.track = value;
    this.progress = this.track.progress_ms / 1000;
    // this.calculateTotalTime();
    this.intervalHandle = setInterval(() => this.countdown(), 1000);
  }

  track;
  timeRemaining = 0; // progressbar value
  currentTime = null; // remaining playtime
  playingTime = null; // played time
  totalTime = null; // total track length
  progress; // temp var for countdown
  intervalHandle = null;

  constructor() { }

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
    const duration = this.track.duration_ms / 1000;
    this.progress = this.progress + 1;
    const timeLeft = duration - this.progress;

    this.timeRemaining = 1 - (timeLeft / duration);

    let s = timeLeft % 60;
    s = Math.round(s);
    const m = Math.floor(timeLeft / 60) % 60;
    const sStr = s < 10 ? '0' + s : '' + s;
    const mStr = m < 10 ? '0' + m : '' + m;
    this.currentTime = mStr + ':' + sStr;

    const mP = Math.floor(this.progress / 60);
    let sP = this.progress % 60;
    sP = s = Math.round(sP);
    const spStr = sP < 10 ? '0' + sP : '' + sP;
    const mpStr = mP < 10 ? '0' + mP : '' + mP;
    this.playingTime = mpStr + ':' + spStr;
  }

  ngOnInit() {
    console.log(this.track);
  }

  ngOnDestroy() {
    clearInterval(this.intervalHandle);
  }


}
