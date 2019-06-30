import { UserDataService } from './../../providers/user-data.service';
import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ModalController, ActionSheetController, ToastController, Platform } from '@ionic/angular';
import { WebsocketService } from 'src/app/providers/websocket.service';
import { MockService } from 'src/app/providers/mock.service';
import { FEService } from './../../providers/fes.service';
import { Track } from 'src/app/models/track';
import { Playlist } from 'src/app/models/playlist';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-playlist',
  templateUrl: 'playlist.page.html',
  styleUrls: ['playlist.page.scss']
})
export class PlaylistPage implements OnInit, OnDestroy {
  public selectedItem: any;

  currentPlaylist: Playlist = null;
  subscriptions: Subscription[] = [];
  username: string = null;
  isCurator = false;

  constructor(
    public modalController: ModalController,
    public actionSheetController: ActionSheetController,
    public toastController: ToastController,
    public websocketService: WebsocketService,
    public mockService: MockService,
    public feService: FEService,
    public userDataService: UserDataService,
    public platform: Platform
  ) {
  }

  playTrack() {
    this.feService.playTrack().subscribe(data => {
      console.log(data);
    });
  }

  deleteTrack(track, index) {
    this.feService.deleteTrack(track.id, index).subscribe(
      res => {
        console.log(res);
        this.presentToast('You have deleted the track.');
      },
      err => console.log(err)
    );
  }

  date2hhmm(d) {
    d = d.toTimeString().split(' ')[0];
    return d.substring(0, 5);
  }

  computeETAForTracks(playlist) {
    console.log("computeETAForTracks");
    var ts = Date.now();
    if (playlist.currentTrack) {
        ts += (playlist.currentTrack.duration_ms - playlist.currentTrack.progress_ms);
    }
    for (var i = 0; i < playlist.nextTracks.length; i++) {
        ts += playlist.nextTracks[i].duration_ms;
        playlist.nextTracks[i].eta= this.date2hhmm(new Date(ts));
    }
  }

  onRenderItems(event) {
    // console.log(`Moving item from ${event.detail.from} to ${event.detail.to}`);
    const draggedItem = this.currentPlaylist.nextTracks.splice(event.detail.from, 1)[0];
    this.currentPlaylist.nextTracks.splice(event.detail.to, 0, draggedItem);

    this.feService.reorderTrack(draggedItem.id, event.detail.from, event.detail.to).subscribe(
      data => {
        this.presentToast('Track successfully reordered in playlist.');
      },
      err => console.log(err)
    );

    event.detail.complete();

  }

  // searchTrackModal
  async presentModal() {
    const modal = await this.modalController.create({
      component: PlaylistAddModalComponent,
      componentProps: { value: 123 }
    });
    modal.onDidDismiss().then(res => {
      console.log(res);
      if (res.data) {
        this.feService.addTrack(res.data.id, 'spotify', this.username).subscribe(
          data => {
            console.log(data);
            this.presentToast('Track added to playlist.');
          },
          err => console.log(err)
        );
      }
    });
    return await modal.present();
  }

  async presentToast(data) {
    const toast = await this.toastController.create({
      message: data,
      position: 'bottom',
      color: 'opendj',
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
            console.log('Delete clicked');
            this.feService.deleteTrack(data.id, index).subscribe(
              res => {
                console.log(res);
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
            console.log('Cancel clicked');
          }
        }]
    });
    if (this.isCurator) {
      await actionSheet.present();
    }

  }

  trackElement(index: number, element: any) {
    return element ? element.id : null;
  }

  ionViewDidEnter() {
    // console.log(this.websocketService.connect());
  }

  ionViewDidLeave() {
    // console.log(this.websocketService.disconnect());
  }

  ngOnInit() {
    const sub: Subscription = this.websocketService.getPlaylist().subscribe(data => {
      // console.log(`playlist: ${JSON.stringify(data)}`);
      this.currentPlaylist = data as Playlist;

      this.computeETAForTracks(this.currentPlaylist);

      console.log(`playlist:`, this.currentPlaylist);
    });
    this.subscriptions.push(sub);
    this.userDataService.getUsername().then(data =>
      this.username = data
    );
    this.userDataService.getCurator().then(data =>
      this.isCurator = data
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
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
    <ion-searchbar [(ngModel)]="queryText" (ionChange)="updateSearch()" placeholder="Search for songs...">
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
        <ion-button (click)="dismiss(item)">Add</ion-button>
      </p>
    </ion-item>

    </ion-list>

</ion-content>
  `
})
export class PlaylistAddModalComponent implements OnInit {
  queryText = '';
  tracks: Array<Track>;

  constructor(
    public modalController: ModalController,
    public feService: FEService) { }

  dismiss(data) {
    this.modalController.dismiss(data);
  }

  updateSearch() {
    this.feService.searchTracks(this.queryText).subscribe(
      data => {
        this.tracks = data;
      },
      err => console.log(err));
  }

  ngOnInit() {
  }
}
