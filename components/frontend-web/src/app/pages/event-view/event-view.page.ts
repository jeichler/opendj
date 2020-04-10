import { ConfigService } from '../../providers/config.service';
import { UserDataService } from '../../providers/user-data.service';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ModalController, ActionSheetController, ToastController, Platform, MenuController } from '@ionic/angular';
import { WebsocketService } from 'src/app/providers/websocket.service';
import { MockService } from 'src/app/providers/mock.service';
import { FEService } from '../../providers/fes.service';
import { MusicEvent, EventStats } from 'src/app/models/music-event';
import { Track } from 'src/app/models/track';
import { Playlist } from 'src/app/models/playlist';
import { Subscription } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { UserSessionState } from 'src/app/models/usersessionstate';
import { EventActivity } from 'src/app/models/eventactivity';

const QRCode = require('qrcode');

@Component({
  selector: 'event-view',
  templateUrl: 'event-view.page.html',
  styleUrls: ['event-view.page.scss']
})
export class EventViewPage implements OnInit, OnDestroy {
  public selectedItem: any;

  currentEvent: MusicEvent = null;
  currentEventStats: EventStats = new EventStats();
  currentPlaylist: Playlist = null;
  subscriptions: Subscription[] = [];
  userState: UserSessionState;
  isCurator = false;
  showOptions = false;
  isConnected = false;
  intervalHandle = null;
  qrImageSrc = null;
  visibleTracks: Track[] = [];
  activityList: EventActivity[] = [];

  tooltipOptions = {
    placement: 'left',
    hideDelayTouchscreen: 2500,
    hideDelayAfterClick: 2500,
    trigger: 'click',
    'max-width': 300,
    'show-delay': 0
  };
  eventURLShortened: string;
/* NO_AUTOSCROLL#264
   autoScrollHandler = null;
  autoScrollPos = 0;
  autoScrollDirection = 1;
*/
  constructor(
    public modalController: ModalController,
    public actionSheetController: ActionSheetController,
    public toastController: ToastController,
    private menu: MenuController,
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
  date2hhmmss(d) {
    d = d.toTimeString().split(' ')[0];
    return d.substring(0, 8);
  }

  showMenu() {
    console.debug('showMenu()');
    this.menu.open('app-menu');
  }

/* NO_AUTOSCROLL#264
   autoScroll() {

    if (this.currentEvent && this.currentEvent.eventViewAutoScrollEnable && this.currentPlaylist && this.currentPlaylist.nextTracks) {
      console.debug('platform width = ', this.platform.width());
      console.debug('autoScroll: pos=' +  this.autoScrollPos + 'dir=' + this.autoScrollDirection + 'speed=' + this.currentEvent.eventViewAutoScrollSpeed);
      const boundOffset = 5;
      this.autoScrollPos = this.autoScrollPos + this.autoScrollDirection * this.currentEvent.eventViewAutoScrollSpeed;
      if (this.autoScrollPos <= boundOffset) {
        // Reached top of list - switch direction to scroll down:
        this.autoScrollPos = boundOffset;
        this.autoScrollDirection = 1;
      } else if (this.autoScrollPos >= this.currentPlaylist.nextTracks.length - boundOffset) {
        // Reached bottom of list -switch direction to scroll up:
        this.autoScrollPos = this.currentPlaylist.nextTracks.length - boundOffset;
        this.autoScrollDirection = -1;
      }

      const trackRow = document.getElementById('track-' + this.autoScrollPos);
      if (trackRow)  {
        trackRow.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }
*/

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
    return element ? element.id : null;
  }

  generateQrCode(text): Promise<string> {
    return new Promise((resolve, reject) => {
      QRCode.toDataURL(text,
      {
        version: '',
        errorCorrectionLevel: 'H',
        margin: 1,
        scale: 4,
        width: 10,
        color: {
          dark: '#000000',
          light: '#A0A0A0'
        }
      }, (err, url) => {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          resolve(url);
        }
      });
    });
  }

  shortenEventUrl(fullURL: string) {
    let result = '';
    if (fullURL.startsWith('https://www.')) {
      result = fullURL.substring(12);
    } else if (fullURL.startsWith('http://www.')) {
      result = fullURL.substring(11);
    } else if (fullURL.startsWith('https://')) {
      result = fullURL.substring(8);
    } else if (fullURL.startsWith('http://')) {
      result = fullURL.substring(7);
    } else if (fullURL.startsWith('www.')) {
      result = fullURL.substring(4);
    } else {
      result = fullURL;
    }
    return result;
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
    let eventID = null;

    // Check if user did login:
    this.userState = await this.userDataService.getUser();
    if (!this.userState.username) {
      this.userState.username = 'AnonEventView';
    }

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

    const newEvent = await this.feService.readEvent(eventID).toPromise();
    console.debug('refreshEvent(): received new event', newEvent);
    this.currentEvent = newEvent;

    await this.handleEventUpdate();
  }

  async handleEventUpdate() {
    console.debug('handlePlaylistUpdate()');

    if (!this.currentEvent) {
      console.error('could not load event from server - something is wrong - redirect to logout');
      this.router.navigate([`ui/landing`]);
      return;
    }

    this.eventURLShortened = this.shortenEventUrl(this.currentEvent.url);
    this.qrImageSrc = await this.generateQrCode(this.currentEvent.url);

 /* NO_AUTOSCROLL#264
    if (this.autoScrollHandler) {
      clearInterval(this.autoScrollHandler);
    }

    if (this.currentEvent.eventViewAutoScrollEnable) {
      this.autoScrollHandler = setInterval(() => {
        this.autoScroll();
      }, this.currentEvent.eventViewAutoScrollInterval * 1000);
    }
*/
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
    console.debug('handlePlaylistUpdate()');
    this.currentPlaylist = newPlaylist;
    this.computeETAForTracks();
 /* NO_AUTOSCROLL#264
    if (this.currentEvent && this.currentEvent.eventViewAutoScrollTopOnNext) {
      this.autoScrollPos = 0;
    }
 */

    // No need to create widgets for the whole list, as we have no scroll bars:
    this.visibleTracks = this.currentPlaylist.nextTracks.slice(0, 15);
  }

  handleActivity(activity) {
    const ts = new Date(activity.timestamp);
    activity.timestamp = this.date2hhmmss(ts);

    this.activityList.unshift(activity);
    while (this.activityList.length > 40) {
      this.activityList.pop();
    }

    if (activity.stats) {
      this.currentEventStats = activity.stats;
    }
  }


  async ionViewDidEnter() {
    console.debug('begin ionViewDidEnter');

    console.debug('getUser()');
    this.userState = await this.userDataService.getUser();
    this.isCurator = this.userState.isCurator;

    console.debug('before refresh()');
    await this.refresh(null);

    if (this.websocketService.isConnected()) {
      this.isConnected = true;
    } else {
      console.debug('ionViewDidEnter() - not connect - init websocket');
      this.websocketService.init(this.currentEvent.eventID, this.userState);
    }

    console.debug('end ionViewDidEnter');
  }

  ionViewDidLeave() {
    console.debug('EventView page leave');
  }
  async init() {
    console.debug('begin init');
  }


  async ngOnInit() {
    console.debug('EventView page init');

    try {
      await this.refresh(null);

      // Connect websocket
      if (this.websocketService.isConnected()) {
        this.isConnected = true;
      } else {
        this.websocketService.init(this.currentEvent.eventID, this.userState);
      }

      let sub = this.websocketService.observePlaylist().pipe().subscribe(data => {
        console.debug('received playlist update via websocket');
        this.handlePlaylistUpdate(data);
      });
      this.subscriptions.push(sub);

      sub = this.websocketService.observeEvent().pipe().subscribe(async data => {
        console.debug('received event update', data);
        this.currentEvent = data as MusicEvent;
        await this.handleEventUpdate();
      });
      this.subscriptions.push(sub);

      sub = this.websocketService.observeActivity().pipe().subscribe(data => {
        console.debug('received activity', data);
        const activity = data as EventActivity;
        this.handleActivity(activity);
      });
      this.subscriptions.push(sub);


      this.intervalHandle = setInterval(() => {
        this.isConnected = this.websocketService.isConnected();
      }, 1000);
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
//    this.websocketService.disconnect();
    clearInterval(this.intervalHandle);
/* NO_AUTOSCROLL#264
    clearInterval(this.autoScrollHandler);
*/
  }

}
