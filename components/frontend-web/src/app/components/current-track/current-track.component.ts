import { FEService } from './../../providers/fes.service';
import { Component, OnInit, Input, OnDestroy, Output, EventEmitter } from '@angular/core';
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
  @Input() trackFeedback: Map<string, string>;

  @Input() set currentEventInput(event: MusicEvent) {
    console.log('set currentEventInput');
    this.currentEvent = event;
    this.setTrackFeedbackColors();
  }
  @Input() user: UserSessionState;

  @Output() currentTrackFeedbackEvent = new EventEmitter<string>();
  @Output() newPlaylist = new EventEmitter<Playlist>();

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
    console.debug('begin setTrack');
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

    this.setTrackFeedbackColors();
  }

  setTrackFeedbackColors() {
    if (this.trackFeedback) {
      const currentFeedback = this.trackFeedback[this.track.id];
      console.debug('currentTrackFeedback', currentFeedback);

      const likeCounter = document.getElementById('track-like-counter');
      if (likeCounter) {
        let newColor = '#666';
        let newWeight = '';
        if (currentFeedback === 'L') {
          // Basic Coloring: highlight if user liked
          newColor = '#fff';
          newWeight = 'bold';

          if (this.currentEvent.enableTrackHateSkip) {
            // User liked this track and hate skip is active.
            // Let's check if the liking would be revoked, would that lead
            // to a hard skip?
            const track = this.track;
            const event = this.currentEvent;
            const numVotes = track.numHates + track.numLikes - 1;
            const numVotes4Quorum = event.skipCurrentTrackQuorum;
            const hatePercentageRequired = event.skipCurrentTrackHatePercentage / 100;
            if (numVotes >= numVotes4Quorum && track.numHates / numVotes >= hatePercentageRequired) {
              // Yes! Skip would happen on revoke. Flag this red:
              newColor = '#ff0000';
            }
          }
        }
        likeCounter.style.color = newColor;
        likeCounter.style.fontWeight = newWeight;
      }

      const hateCounter = document.getElementById('track-hate-counter');
      if (hateCounter) {
        let newColor = '#666';
        let newWeight = '';
        if (currentFeedback === 'H') {
          newColor = '#fff';
          newWeight = 'bold';
        }

        if (this.currentEvent.enableTrackHateSkip) {
          // Let's check if hating this track would lead
          // to a hard skip?
          const track = this.track;
          const event = this.currentEvent;
          const numVotes = track.numHates + track.numLikes;
          const numVotes4Quorum = event.skipCurrentTrackQuorum;
          const hatePercentageRequired = event.skipCurrentTrackHatePercentage / 100;
          if (numVotes + 1 >= numVotes4Quorum && (track.numHates + 1) / (numVotes + 1) >= hatePercentageRequired) {
            // Yes! Skip would happen on hate. Flag this red:
            if (currentFeedback === 'H') {
              newColor = '#ff0000';
            } else {
              newColor = '#aa0000';
            }
          } else if (numVotes + 5 >= numVotes4Quorum && (track.numHates + 5) / (numVotes + 5) >= hatePercentageRequired) {
            // 5 additional hates would lead to hard skip: flag this yellow:
            if (currentFeedback === 'H') {
              newColor = '#ffff00';
            } else {
              newColor = '#aaaa00';
            }
          }
        }

        hateCounter.style.color = newColor;
        hateCounter.style.fontWeight = newWeight;
      }
    } else {
      console.debug('no track feedback?');
    }
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
  trackLike() {
    console.debug('trackLike() current');
    this.currentTrackFeedbackEvent.emit('L');
  }

  trackHate() {
    console.debug('trackHate() current');
    this.currentTrackFeedbackEvent.emit('H');
  }

  playTrack() {
    console.debug('playTrack()');
    this.feService.playTrack(this.currentEvent, this.user).subscribe(data => {
      console.debug('current-track - playTrackResponse');
      this.isPlaying = data.isPlaying;
      this.setTrack(data.currentTrack);
      this.newPlaylist.emit(data);
    });
  }

  pauseTrack() {
    console.debug('pauseTrack()');
    this.feService.pauseTrack(this.currentEvent, this.user).subscribe(data => {
      console.debug('current-track - pauseTrackResponse');
      this.isPlaying = data.isPlaying;
      this.setTrack(data.currentTrack);
      this.newPlaylist.emit(data);
    });
  }

  nextTrack() {
    console.debug('nextTrack()');
    this.feService.playNextTrack(this.currentEvent, this.user).subscribe(data => {
      console.debug('current-track - nextTrack');
      this.isPlaying = data.isPlaying;
      this.setTrack(data.currentTrack);
      this.newPlaylist.emit(data);
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
    console.debug('current-track-component-ngOnInit');
    this.setTrack(this.track);
  }

  ngOnDestroy() {
    clearInterval(this.intervalHandle);
  }


}
