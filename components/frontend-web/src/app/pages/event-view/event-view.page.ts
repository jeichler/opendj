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
  selector: 'event-view',
  templateUrl: 'event-view.page.html',
  styleUrls: ['event-view.page.scss']
})
export class EventViewPage implements OnInit, OnDestroy {
  public selectedItem: any;

  currentEvent: MusicEvent = null;
  currentPlaylist: Playlist = null;
  subscriptions: Subscription[] = [];
  userState: UserSessionState;
  isCurator = false;
  showOptions = false;
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



  date2hhmm(d) {
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
        const track = playlist.nextTracks[i];
        track.eta = this.date2hhmm(new Date(ts));
        ts += track.duration_ms;

        track.durationStr = new Date(track.duration_ms).toISOString().slice(14, 19);
      }
    }
  }


  trackElement(index: number, element: any) {
    // return element ? element.id : null;
    // tslint:disable-next-line:no-unused-expression
    return index + ', ' + element.id;
  }
  async refresh(event) {
    console.debug('begin refresh');
    try {
      await this.refreshEvent();
      await this.refreshPlaylist();
    } catch (err) {
      console.error('Refresh failed!', err);
    } finally {
      if (event) {
        event.detail.complete();
      }
    }
    console.debug('end refresh');
  }

  async refreshEvent() {
    console.debug('refreshEvent()');
    const eventID = this.currentEvent.eventID;
    const newEvent = await this.feService.readEvent(eventID).toPromise();
    console.debug('refreshEvent(): received new event');
    this.currentEvent = newEvent;
    if (!this.currentEvent) {
      console.error('could not load event from server - something is wrong - redirect to logout');
      this.router.navigate([`ui/landing`]);
      return;
    }
  }

  async refreshPlaylist() {
    console.debug('refreshPlaylist()');
    if (this.currentEvent) {
      console.debug('getCurrentPlaylist() from server');
      const newList = await this.feService.getCurrentPlaylist(this.currentEvent).toPromise();
      console.debug('refreshPlaylist(): received new Playlist');
      this.handlePlaylistUpdate(newList);
    } else {
      console.warn('refreshPlaylist() without currentEvent?!');
    }
  }

  handlePlaylistUpdate(newPlaylist) {
    this.currentPlaylist = newPlaylist;
    this.computeETAForTracks();
  }


  async ionViewDidEnter() {
    console.debug('begin ionViewDidEnter');
    setTimeout(() => {
      if (!this.websocketService.isConnected) {
        console.debug('ionViewDidEnter() - not connect - init websocket');
        this.websocketService.init(this.currentEvent.eventID);
      }
    }, 100);

    console.debug('getUser()');
    this.userState = await this.userDataService.getUser();
    this.isCurator = this.userState.isCurator;

    console.debug('before refresh()');
    await this.refresh(null);
    console.debug('end ionViewDidEnter');
  }

  ionViewDidLeave() {
    console.debug('EventView page leave');
  }
  async init() {
    console.debug('begin init');
    console.debug('end init');
  }


  async ngOnInit() {
    console.debug('EventView page init');
    let eventID = null;

    try {
      // Check if user did login:
      this.userState = await this.userDataService.getUser();
      if (this.userState && this.userState.isLoggedIn && this.userState.currentEventID) {
        console.debug('EventID from user');
        eventID = this.userState.currentEventID;
      } else {
        console.debug('EventID from route');
        eventID = this.route.snapshot.paramMap.get('eventID');
      }

      if (!eventID) {
        throw new Error('No EvenID?!');
      }

      console.debug('trying to load EventID', eventID);
      this.currentEvent = await this.feService.readEvent(eventID).toPromise();
      console.debug('init event=', this.currentEvent);

      if (this.currentEvent === null) {
        throw new Error('Event >' + eventID + '< not found -> redirect to landing page');
      }

      // Connect websocket
      this.websocketService.init(eventID);

      let sub = this.websocketService.observePlaylist().pipe().subscribe(data => {
        console.debug('received playlist update via websocket');
        this.currentPlaylist = data as Playlist;
        this.computeETAForTracks();
        console.debug(`playlist subscription: `, this.currentPlaylist);
      });
      this.subscriptions.push(sub);

      sub = this.websocketService.observeEvent().pipe().subscribe(data => {
        console.debug('received event update');
        this.currentEvent = data as MusicEvent;
        if (this.currentEvent) {
          console.info(`event update: `, this.currentEvent);
        } else {
          console.warn('Event has been deleted - navigating to landing page');
          this.router.navigate([`ui/landing`]);
        }
      });
      this.subscriptions.push(sub);

      this.intervalHandle = setInterval(() => {
        this.isConnected = this.websocketService.isConnected();
      }, 2500);
    } catch (err) {
      console.error('init failed - nav2landing', err);
      this.router.navigateByUrl('ui/landing');
    }
  }

  ngOnDestroy() {
    console.debug('page destroy');
    this.subscriptions.forEach((sub) => {
      sub.unsubscribe();
    });
    this.websocketService.disconnect();
    clearInterval(this.intervalHandle);
  }

}
