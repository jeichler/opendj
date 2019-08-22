import { ConfigService } from './../../providers/config.service';
import { UserDataService } from './../../providers/user-data.service';
import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ModalController, ActionSheetController, ToastController, Platform, IonSearchbar } from '@ionic/angular';
import { WebsocketService } from 'src/app/providers/websocket.service';
import { MockService } from 'src/app/providers/mock.service';
import { FEService } from './../../providers/fes.service';
import { MusicEvent } from 'src/app/models/music-event';
import { Track } from 'src/app/models/track';
import { Playlist } from 'src/app/models/playlist';
import { Subscription } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { UserSessionState } from 'src/app/models/usersessionstate';

@Component({
  selector: 'app-playlist',
  templateUrl: 'playlist.page.html',
  styleUrls: ['playlist.page.scss']
})
export class PlaylistPage implements OnInit, OnDestroy {
  public selectedItem: any;

  currentEvent: MusicEvent = null;
  currentPlaylist: Playlist = null;
  subscriptions: Subscription[] = [];
  userState: UserSessionState;
  isCurator = false;
  showOptions = false;
  isConnected = false;
  intervalHandle = null;

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

    ) {
  }

  playTrack() {
    this.feService.playTrack(this.currentEvent).subscribe((data) => {
      // console.log(data);
    },
    (err) => {
      console.error(err.msg);
    });
  }

  deleteTrack(track, index) {
    this.feService.deleteTrack(this.currentEvent, track.id, index).subscribe(
      res => {
        // console.log(res);
        this.presentToast('You have deleted the track.');
      },
      err => console.error(err)
    );
  }

  refresh(event) {
    this.websocketService.refreshPlaylist();
    setTimeout(() => {
      event.detail.complete();
    }, 1000);
  }

  date2hhmm(d) {
    d = d.toTimeString().split(' ')[0];
    return d.substring(0, 5);
  }

  computeETAForTracks(playlist) {
    console.debug('computeETAForTracks');
    let ts = Date.now();
    if (playlist.currentTrack) {
        ts += (playlist.currentTrack.duration_ms - playlist.currentTrack.progress_ms);
    }
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < playlist.nextTracks.length; i++) {
        playlist.nextTracks[i].eta = this.date2hhmm(new Date(ts));
        ts += playlist.nextTracks[i].duration_ms;
    }
  }

  onRenderItems(event) {
    // console.log(`Moving item from ${event.detail.from} to ${event.detail.to}`);
    const draggedItem = this.currentPlaylist.nextTracks.splice(event.detail.from, 1)[0];
    this.currentPlaylist.nextTracks.splice(event.detail.to, 0, draggedItem);
    this.feService.reorderTrack(this.currentEvent, draggedItem.id, event.detail.from, event.detail.to).subscribe(
      data => {
        this.presentToast('Track successfully reordered in playlist.');
      },
      err => console.log(err)
    );
    event.detail.complete();
  }

  toggleOptions() {
    if (this.showOptions) {
      this.showOptions = false;
    } else {
      this.showOptions = true;
    }
  }

  moveTop(item, index, slidingItem) {
    if (this.isCurator) {
      this.feService.reorderTrack(this.currentEvent, item.id, index, 0).subscribe(
        data => {
          this.presentToast('Track moved to top.');
          // slidingItem.close();
        },
        err => console.error(err)
      );
    }
  }

  async presentModal() {
    const modal = await this.modalController.create({
      component: PlaylistAddModalComponent,
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

  async presentActionSheet(data, index) {
    const actionSheet = await this.actionSheetController.create({
      header: data.title,
      buttons: [
        {
          text: 'Play (preview mode)',
          icon: 'arrow-dropright-circle',
          handler: () => {
            console.log('Play clicked');
          }
        },
        {
          text: 'Delete',
          role: 'destructive',
          icon: 'trash',
          handler: () => {
            console.debug('Delete clicked');
            this.feService.deleteTrack(this.currentEvent, data.id, index).subscribe(
              res => {
                console.debug(res);
                this.presentToast('You have deleted the track.');
              },
              err => console.log(err)
            );
          }
        }, {
          text: 'Cancel',
          icon: 'close',
          role: 'cancel',
          handler: () => {
            console.debug('Cancel clicked');
          }
        }]
    });
    if (this.isCurator) {
      await actionSheet.present();
    }

  }

  trackElement(index: number, element: any) {
    // return element ? element.id : null;
    // tslint:disable-next-line:no-unused-expression
    return index + ', ' + element.id;
  }

  async ionViewDidEnter() {
    console.debug('Playlist page enter');
    setTimeout(() => {
      if (!this.websocketService.isConnected) {
        this.websocketService.init(this.currentEvent.eventID);
        this.websocketService.refreshPlaylist();
      }
    }, 100);

    this.userState = await this.userDataService.getUser();
    this.isCurator = this.userState.isCurator;
  }

  ionViewDidLeave() {
    console.debug('Playlist page leave');
  }

  async ngOnInit() {
    console.debug('Playlist page init');
    this.userState  = await this.userDataService.getUser();
    const eventID = this.userState.currentEventID;

    console.debug('Get Event %s from server', eventID);

    this.currentEvent = await this.feService.readEvent(eventID).toPromise();
//    this.currentEvent = new MusicEvent;
//    this.currentEvent.eventID= "0";
    console.debug('Event from Server: %s', JSON.stringify(this.currentEvent));


    this.websocketService.init(this.currentEvent.eventID);
    this.websocketService.refreshPlaylist();

    const sub: Subscription = this.websocketService.getPlaylist().pipe().subscribe(data => {
      console.debug('playlist-page - received playlist update');
      this.currentPlaylist = data as Playlist;
      if (this.currentPlaylist.hasOwnProperty('nextTracks')) {
        this.computeETAForTracks(this.currentPlaylist);
      }
      console.debug(`playlist subscription: `, this.currentPlaylist);
    });
    this.subscriptions.push(sub);
    this.intervalHandle = setInterval(() => {
      this.isConnected = this.websocketService.isConnected();
    }, 3000);
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
    <ion-searchbar  [(ngModel)]="queryText" (ionChange)="updateSearch()" placeholder="Search for songs..." #myInput>
    </ion-searchbar>
  </ion-toolbar>
</ion-header>

<ion-content color="light">

  <ion-list color="light">

    <ion-item color="light" *ngFor="let item of tracks">
      <ion-thumbnail slot="start">
        <img src="{{item.image_url}}">
      </ion-thumbnail>
      <ion-label text-wrap>{{item.name}}<br />
        <span style="font-size: 14px; color: #666;">{{item.artist}}, {{item.year}}</span><br />
      </ion-label>
      <p>
        <ion-button (tap)="dismiss(item)">Add</ion-button>
      </p>
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
