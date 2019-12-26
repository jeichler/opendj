import { ConfigService } from '../../providers/config.service';
import { UserDataService } from '../../providers/user-data.service';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ModalController, ActionSheetController, ToastController, Platform, MenuController } from '@ionic/angular';
import { WebsocketService } from 'src/app/providers/websocket.service';
import { MockService } from 'src/app/providers/mock.service';
import { FEService } from '../../providers/fes.service';
import { MusicEvent } from 'src/app/models/music-event';
import { Track } from 'src/app/models/track';
import { Playlist } from 'src/app/models/playlist';
import { Subscription } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { UserSessionState } from 'src/app/models/usersessionstate';

const QRCode = require('qrcode');

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
  qrImageSrc = null;

  tooltipOptions = {
    placement: 'left',
    hideDelayTouchscreen: 2500,
    hideDelayAfterClick: 2500,
    trigger: 'click',
    'max-width': 300,
    'show-delay': 0
  };
  eventURLShortened: string;
  autoScrollHandler = null;
  autoScrollPos = 0;
  autoScrollDirection = 1;

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

  isVisible(el): boolean {
    const top = el.getBoundingClientRect().top;
    let rect;
    el = el.parentNode;
    do {
        rect = el.getBoundingClientRect();
        if (top <= rect.bottom === false) {
            return false;
        }
        el = el.parentNode;
    } while (el !== document.body);
    // Check its within the document viewport
    return top <= document.documentElement.clientHeight;
  }
  showMenu() {
    console.debug('showMenu()');
    this.menu.open('app-menu');
  }

  autoScroll() {

/* Implementation by scroll per track: */
    if (this.currentEvent && this.currentEvent.eventViewAutoScrollEnable && this.currentPlaylist && this.currentPlaylist.nextTracks) {
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

  /* Implementation to scroll pixel wise: */
  /* Problem: isVisible not working correctly
     const lastTrack = document.getElementById('track-20');
     const firstTrack = document.getElementById('track-0');

     if (this.isVisible(firstTrack)) {
      this.autoScrollDirection = 1;
    } else if (this.isVisible(lastTrack)) {
      this.autoScrollDirection = -1;
    }
     document.getElementById('track-grid').scrollBy(0, this.autoScrollDirection);
*/
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

    if (this.autoScrollHandler) {
      clearInterval(this.autoScrollHandler);
    }

    if (this.currentEvent.eventViewAutoScrollEnable) {
      this.autoScrollHandler = setInterval(() => {
        this.autoScroll();
      }, this.currentEvent.eventViewAutoScrollInterval * 1000);
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
    console.debug('handlePlaylistUpdate()');
    this.currentPlaylist = newPlaylist;
    this.computeETAForTracks();
    if (this.currentEvent && this.currentEvent.eventViewAutoScrollTopOnNext) {
      this.autoScrollPos = 0;
    }
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
  }


  async ngOnInit() {
    console.debug('EventView page init');

    try {
      await this.refresh(null);

      // Connect websocket
      this.websocketService.init(this.currentEvent.eventID);

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
    clearInterval(this.autoScrollHandler);
  }

}
