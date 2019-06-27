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
    this.calculateTotalTime();
    this.intervalHandle = setInterval(() => this.countdown(), 1000);
  }

  track;
  timeRemaining = 0;
  currentTime = null;
  totalTime = null;
  progress;
  intervalHandle = null;

  constructor() { }

  calculateTotalTime() {
    const duration = this.track.duration_ms / 1000;
    let s = duration % 60;
    let m = Math.floor(duration / 60) % 60;
    s = Math.round(s);
    s = s < 10 ? '0' + s : s;
    m = m < 10 ? '0' + m : m;
    this.totalTime = m + ':' + s;
  }

  countdown() {
    const duration = this.track.duration_ms / 1000;
    this.progress = this.progress + 1;
    const timeLeft = duration - this.progress;
    this.timeRemaining = 1 - (timeLeft / duration);
    // console.log(1 - (timeLeft / duration));
    let s = timeLeft % 60;
    s = Math.round(s);
    let m = Math.floor(timeLeft / 60) % 60;
    let sStr = s < 10 ? '0' + s : ''+s;
    let mStr = m < 10 ? '0' + m : ''+m;
    this.currentTime = mStr + ':' + sStr;
  }

  ngOnInit() {
    console.log(this.track);
  }

  ngOnDestroy() {
    clearInterval(this.intervalHandle);
  }


}
