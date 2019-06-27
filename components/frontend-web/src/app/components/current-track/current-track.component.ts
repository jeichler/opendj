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
    this.intervalHandle = setInterval(() => this.countdown(), 1000);
  }

  track;
  timeRemaining = 0;
  progress;
  intervalHandle = null;

  constructor() { }

  calculateTime() {

    let duration = this.track.duration_ms / 1000;
    let currentTime = this.track.progress_ms / 1000;
    let timeLeft = duration - currentTime;
    let s, m;

    console.log(1 - (timeLeft / duration));
    this.timeRemaining = 1 - (timeLeft / duration);

    s = timeLeft % 60;
    m = Math.floor(timeLeft / 60) % 60;

    s = s < 10 ? '0' + s : s;
    m = m < 10 ? '0' + m : m;

    console.log(m + ':' + s + ' remaining...');

  }

  countdown() {
    const duration = this.track.duration_ms / 1000;
    this.progress = this.progress + 1;
    const timeLeft = duration - this.progress;
    this.timeRemaining = 1 - (timeLeft / duration);
    // console.log(1 - (timeLeft / duration));
  }

  ngOnInit() {
    console.log(this.track);
  }

  ngOnDestroy() {
    clearInterval(this.intervalHandle);
  }


}
