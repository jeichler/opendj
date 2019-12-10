import { ConfigService } from '../../providers/config.service';
import { UserDataService } from '../../providers/user-data.service';
import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ModalController, ActionSheetController, ToastController, Platform, IonSearchbar } from '@ionic/angular';
import { WebsocketService } from 'src/app/providers/websocket.service';
import { MockService } from 'src/app/providers/mock.service';
import { FEService } from '../../providers/fes.service';
import { MusicEvent } from 'src/app/models/music-event';
import { Track } from 'src/app/models/track';
import { Playlist } from 'src/app/models/playlist';
import { Subscription } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { UserSessionState } from 'src/app/models/usersessionstate';

@Component({
  selector: 'app-playlist',
  templateUrl: 'playlist-user.page.html',
  styleUrls: ['playlist-user.page.scss']
})
export class PlaylistUserPage implements OnInit, OnDestroy {
  public selectedItem: any;

  currentEvent: MusicEvent = null;
  currentPlaylist: Playlist = null;
  subscriptions: Subscription[] = [];
  userState: UserSessionState;
  isConnected = false;
  intervalHandle = null;
  tooltipOptions = {
    placement: 'left',
    hideDelayTouchscreen: 2500,
    hideDelayAfterClick: 2500,
    trigger: 'click',
    'max-width': 300,
    'show-delay': 0
  };

  trackFeedback = {};

  constructor(
    public modalController: ModalController,
    public actionSheetController: ActionSheetController,
    public toastController: ToastController,
    public websocketService: WebsocketService,
    public mockService: MockService,
    public feService: FEService,
    public userDataService: UserDataService,
    public configService: ConfigService,
    public platform: Platform,
    private route: ActivatedRoute,
    public router: Router,
    ) {
  }


  refresh(event) {
    console.debug('refresh');
    this.refreshEvent();
    this.refreshPlaylist();
    event.detail.complete();
  }

  date2hhmm(d): string {
    d = d.toTimeString().split(' ')[0];
    return d.substring(0, 5);
  }

  computeETAForTracks() {
    const playlist = this.currentPlaylist;
    let ts = Date.now();
    if (playlist.currentTrack) {
        ts += (playlist.currentTrack.duration_ms - playlist.currentTrack.progress_ms);
    }
    if (playlist.nextTracks) {
      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < playlist.nextTracks.length; i++) {
          playlist.nextTracks[i].eta = this.date2hhmm(new Date(ts));
          ts += playlist.nextTracks[i].duration_ms;
      }
    }
  }

  ensureFeedbackAttributes(track: Track) {
    if (!track.numLikes) {
      track.numLikes = 0;
    }
    if (!track.numHates) {
      track.numHates = 0;
    }
  }

  ensureTrackFeedbackEmojis() {
    if (!this.currentEvent.emojiTrackLike) {
      this.currentEvent.emojiTrackLike = '🥰';
    }
    if (!this.currentEvent.emojiTrackHate) {
      this.currentEvent.emojiTrackHate = '🤮';
    }
  }



  isTrackLiked(track: Track) {
    return this.trackFeedback[track.id] === 'L';
  }

  isTrackHated(track: Track) {
    return this.trackFeedback[track.id] === 'H';
  }

  trackLike(track) {
    console.debug('begin trackLike()');
    let oldFeedback = this.trackFeedback[track.id];
    let newFeedback = 'L';
    let message = '';

    this.ensureFeedbackAttributes(track);
    if (!oldFeedback) {
      oldFeedback = '';
    }

    if (oldFeedback === 'H' && newFeedback === 'L') {
      // User change her mind from hate to like, thus we need to reduce hate counter:
      track.numHates--;
    }

    if (oldFeedback === 'L' && newFeedback === 'L') {
      // User liked in the past and now clicked like again,
      // meaning to remove the like:
      track.numLikes--;
      newFeedback = '';
      message = 'Tack <b>liking</b> revoked';
    } else {
      track.numLikes++;
      message = 'Tack <b>likening</b> registered';
    }

    this.trackFeedbackSanityCheck(track);
    this.trackFeedback[track.id] =  newFeedback;
    this.updateUserStateWithTrackFeedback();
    this.feService.provideTrackFeedback(this.currentEvent, track, oldFeedback, newFeedback).subscribe();
    this.presentToast(message);
    }

  trackHate(track: Track) {
    console.debug('begin trackHate()');
    let oldFeedback = this.trackFeedback[track.id];
    let newFeedback = 'H';
    let message = '';

    this.ensureFeedbackAttributes(track);

    if (!oldFeedback) {
      oldFeedback = '';
    }

    if (oldFeedback === 'L' && newFeedback === 'H') {
      // User change her mind from like to hate, thus we need to reduce hate counter:
      track.numLikes--;
    }

    if (oldFeedback === 'H' && newFeedback === 'H') {
      // User liked in the past and now clicked like again,
      // meaning to remove the like:
      track.numHates--;
      newFeedback = '';
      message = 'Track <b>hating</b> revoked';
    } else {
      track.numHates++;
      message = 'Track <b>hating</b> registered';
    }
    this.trackFeedbackSanityCheck(track);
    this.trackFeedback[track.id] = newFeedback;
    this.updateUserStateWithTrackFeedback();
    this.feService.provideTrackFeedback(this.currentEvent, track, oldFeedback, newFeedback).subscribe();
    this.presentToast(message);
  }

  trackFeedbackSanityCheck(track: Track) {
    if (track.numLikes < 0) {
      track.numLikes = 0;
    }
    if (track.numHates < 0) {
      track.numHates = 0;
    }

  }

  updateUserStateWithTrackFeedback() {
    this.userState.trackFeedback = this.trackFeedback;
    this.userDataService.updateUser(this.userState);
  }

  async trackSearch() {
    const modal = await this.modalController.create({
      component: PlaylistAddModalComponent,
      mode: 'md',
      componentProps: {
        currentEvent: this.currentEvent }
    });
    modal.onDidDismiss().then(res => {
      if (res.data) {
        this.feService.addTrack(this.currentEvent, res.data.id, 'spotify', this.userState.username).subscribe(
          data => {
            this.presentToast('Track added to playlist.');
          },
          err => console.error(err)
        );
      }
    });
    return await modal.present();
  }

  async presentToast(data) {
    const toast = await this.toastController.create({
      message: data,
      position: 'top',
      color: 'light',
      duration: 2000
    });
    toast.present();
  }

  trackElement(index: number, element: any) {
    // return element ? element.id : null;
    // tslint:disable-next-line:no-unused-expression
    return index + ', ' + element.id;
  }

  checkEverybodyIsCuratorStateChange() {
    if (this.userState.loginContext === 'user') {
      console.debug('Simple user detected - check if everybodyIsCurator did change');
      const oldCuratorState = this.userState.isCurator;
      const newCuratorState = this.currentEvent.everybodyIsCurator;
      if (oldCuratorState !== newCuratorState) {
        console.debug('everybodyIsCurator did change: newCuratorState=%s', newCuratorState);
        this.userState.isCurator = newCuratorState;
        this.userDataService.updateUser(this.userState);

        if (newCuratorState) {
          this.presentToast('Everbody is curator now - checkout the menu!');
        } else {
          this.presentToast('Sorry, everybody is curator right has been revoked by event owner');
        }
      }
    }
  }

  refreshEvent() {
    console.debug('refreshEvent()');
    const eventID = this.userState.currentEventID;
    this.feService.readEvent(eventID).subscribe(
      newEvent => {
        console.debug('refreshEvent(): received new event');
        this.currentEvent = newEvent;
        this.checkEverybodyIsCuratorStateChange();
      }
    );
  }

  refreshPlaylist() {
    console.debug('refreshPlaylist()');
    if (this.currentEvent) {
      console.debug('getCurrentPlaylist() from server');
      this.feService.getCurrentPlaylist(this.currentEvent).subscribe(
        newList => {
          console.debug('refreshPlaylist(): received new Playlist');
          this.currentPlaylist = newList;
          this.computeETAForTracks();
        },
        err => console.error('ionViewDidEnter(): getCurrentPlaylistFailed', err)
      );
    } else {
      console.warn('refreshEvent() without currentEvent?!');
    }
  }


  async ionViewDidEnter() {
    console.debug('Playlist page enter');
    setTimeout(() => {
      if (!this.websocketService.isConnected) {
        console.debug('ionViewDidEnter() - not connect - init websocket');
        this.websocketService.init(this.currentEvent.eventID);
      }
    }, 100);

    console.debug('getUser()');
    this.userState = await this.userDataService.getUser();
    if (this.userState.trackFeedback) {
      console.debug('Using trackFeedback from userState', this.userState);
      this.trackFeedback = this.userState.trackFeedback;
    } else {
      console.debug('Using fresh trackFeedback map');
      this.trackFeedback = {};
    }

    console.debug('getCurrentPlaylist()');
    this.refreshPlaylist();
  }

  ionViewDidLeave() {
    console.debug('Playlist page leave');
  }

  async ngOnInit() {
    console.debug('Playlist page init');
    this.userState  = await this.userDataService.getUser();
    const eventID = this.userState.currentEventID;


    // Check that event does exists by requesting it from the server:
    console.debug('Get Event %s from server', eventID);
    this.currentEvent = await this.feService.readEvent(eventID).toPromise();
    console.debug('Event from Server: %s', JSON.stringify(this.currentEvent));
    if (!this.currentEvent) {
        console.error('could not load event from server - something is wrong - redirect to logout');
        this.router.navigate([`ui/login`]);
        return;
    }

    this.ensureTrackFeedbackEmojis();

    // Connect websocket - no need to request current playlist, it will be sent
    // as part of the welcome package upon successful connect (see service-web#onConnect())
    this.websocketService.init(this.currentEvent.eventID);

    let sub = this.websocketService.observePlaylist().pipe().subscribe(data => {
      console.debug('playlist-page - received playlist update via websocket');
      this.currentPlaylist = data as Playlist;
      this.computeETAForTracks();
      console.debug(`playlist subscription: `, this.currentPlaylist);
    });
    this.subscriptions.push(sub);

    sub = this.websocketService.observeEvent().pipe().subscribe(data => {
      console.debug('playlist-page - received event update');
      this.currentEvent = data as MusicEvent;
      if (this.currentEvent) {
        console.info(`event update: `, this.currentEvent);
        this.checkEverybodyIsCuratorStateChange();
      } else {
        console.warn('Event has been deleted - navigating to landing page');
        this.router.navigate([`ui/landing`]);
      }
    });
    this.subscriptions.push(sub);

    this.intervalHandle = setInterval(() => {
      this.isConnected = this.websocketService.isConnected();
    }, 2500);

  //  this.refreshPlaylist();
  }

  ngOnDestroy() {
    console.debug('Playlist page destroy');
    this.subscriptions.forEach((sub) => {
      sub.unsubscribe();
    });
    this.websocketService.disconnect();
    clearInterval(this.intervalHandle);
  }

}


/**
 * Add to playlist modal
 * Search for songs and add to current playlist.
 */
@Component({
  selector: 'app-playlist-add-modal',
  template: `
  <ion-header>
  <ion-toolbar color="dark">
    <ion-buttons slot="start">
      <ion-button (click)="dismiss(null)">
        <ion-icon slot="icon-only" name="close"></ion-icon>
      </ion-button>
    </ion-buttons>
    <ion-title>Add song to playlist</ion-title>
  </ion-toolbar>
  <ion-toolbar color="dark">
    <ion-searchbar id="search" [(ngModel)]="queryText" (ionChange)="updateSearch()" placeholder="Search for tracks, albums or artist" #myInput>
    </ion-searchbar>
  </ion-toolbar>
</ion-header>

<ion-content color="light">

  <ion-list color="light">

    <ion-item color="light" *ngFor="let item of tracks">
      <ion-thumbnail slot="start">
        <a href="{{item.image_url_ref}}" target="_blank">
          <img src="{{item.image_url}}">
        </a>
      </ion-thumbnail>
      <ion-label>{{item.name}}<br />
        <span style="font-size: 14px; color: #666;">{{item.artist}}, {{item.year}}</span><br />
      </ion-label>

      <a *ngIf="item.previewViaApp" href="{{item.previewViaApp}}" target="_blank">
        <ion-img float-right src="assets/img/spotify/Spotify_Icon_RGB_Green_64.png" style="width: 21px; height: 21px; margin-right:10px; margin-left:10px"></ion-img>
      </a>
      <ion-button id="add-result-{{item.id}}" float-right (click)="dismiss(item)" tappable>Add</ion-button>

      </ion-item>

    </ion-list>

</ion-content>
  `
})
export class PlaylistAddModalComponent implements OnInit {
  currentEvent: MusicEvent;
  queryText = '';
  tracks: Array<Track>;


  @ViewChild(IonSearchbar) myInput: IonSearchbar;

  setFocus() {
    console.debug('Set search focus');
    this.myInput.setFocus();

  }

  constructor(
    public modalController: ModalController,
    public feService: FEService) { }
  dismiss(data) {
    this.modalController.dismiss(data);
  }

  updateSearch() {
    this.feService.searchTracks(this.currentEvent, this.queryText).subscribe(
      data => {
        this.tracks = data;
      },
      err => console.error(err));
  }

  ngOnInit() {
    setTimeout(() => {
      this.setFocus();
    }, 150);
  }
}
