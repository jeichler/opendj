import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { Events, ModalController, ToastController, AlertController, PopoverController } from '@ionic/angular';
import { UserDataService } from '../../providers/user-data.service';
import { MusicEvent } from 'src/app/models/music-event';
import { FEService } from 'src/app/providers/fes.service';
import { UserSessionState } from 'src/app/models/usersessionstate';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import * as moment from 'moment';
import { LoginModalComponent } from 'src/app/components/login-modal/login-modal.component';

@Component({
  selector: 'event',
  templateUrl: './event.page.html',
  styleUrls: ['./event.page.scss'],
})
export class EventPage implements OnDestroy {

  event: MusicEvent;
  userState: UserSessionState;
  navigationSubscription;

  constructor(
    public router: Router,
    private events: Events,
    public userDataService: UserDataService,
    public feService: FEService,
    private route: ActivatedRoute,
    public modalController: ModalController,
    public toastController: ToastController,
    public alertController: AlertController,
    public popOverCtrl: PopoverController
  ) {
    this.navigationSubscription = this.router.events.subscribe((e: any) => {
      if (e instanceof NavigationEnd) {
        console.debug('catching nav end -> init page');
        this.init();
      }
    });
  }

  async presentModal(ctx) {
    const modal = await this.modalController.create({
      component: LoginModalComponent,
      animated: true,
      mode: 'md',
      componentProps: {
        currentEvent: this.event,
        context: ctx
      }
    });

    modal.onDidDismiss().then(res => {
      // if (res.data) {}
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

  async presentMoreOptions(ev: any) {
    console.debug('presentMoreOptions');
    const popover = await this.popOverCtrl.create({
      component: MoreOptionsComponent,
      event: ev,
      translucent: true
    });

    popover.onDidDismiss().then((newCtx) => {
      console.debug('onDidDismiss');

      if (newCtx !== null && newCtx.data) {
        if (newCtx.data === 'switch') {
          // TODO
        } else {
          // TODO
        }
      }
    });
    return await popover.present();
  }

  formatDate(date) {
    return moment(date).format('DD.MM.YYYY | HH:MM');
  }

  editEvent() {
    console.debug('editEvent');
    this.router.navigateByUrl('/ui/create-event');
  }

  async deleteAlertConfirm() {
    const alert = await this.alertController.create({
      header: 'Delete Event!',
      message: 'Are you sure you want to <strong>delete</strong> this event?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary',
          handler: (data) => {

          }
        }, {
          text: 'Okay',
          handler: () => {
            this.deleteEvent();
          }
        }
      ]
    });

    await alert.present();
  }


  deleteEvent() {
    console.debug('deleteEvent');
    this.feService.deleteEvent(this.event.eventID).subscribe((event) => {
      console.debug('deleteEvent -> SUCCESS');
      this.clearNavSubscription();
      this.presentToast('You have successfully DELETED this event. Now redirecting to Landing page.');
      this.events.publish('user:logout', { redirect: 'ui/landing' });
    },
      (err) => {
        this.presentToast('ERROR: Event could not be deleted');
        console.error('Calling server side delete event...FAILED', err);
      });
  }

  logout() {
    this.events.publish('user:logout');
  }

  clearNavSubscription() {
    if (this.navigationSubscription) {
      this.navigationSubscription.unsubscribe();
    }
  }

  async init() {
    console.debug('init');
    this.userState = await this.userDataService.getUser();
    const eventID = this.route.snapshot.paramMap.get('eventId');
    this.event = await this.feService.readEvent(eventID).toPromise();
    console.debug(this.event);

    // redirect to landing page if event doesn't exist
    if (this.event === null) {
      console.debug('Event not found -> redirect to landing page');
      this.presentToast('SORRY! Event could not be found. Now redirecting to Landing page.');
      this.clearNavSubscription();
      this.router.navigateByUrl('ui/landing');
    }
  }

  ngOnDestroy() {
    console.debug('ngOnDestroy');
    this.clearNavSubscription();
  }
}


/**
 * More Login-Options
 */
@Component({
  selector: 'event-more-options',
  templateUrl: 'more-options-component.html'
})
export class MoreOptionsComponent implements OnInit {

  constructor(
    private router: Router,
    public userDataService: UserDataService,
    public popOverCtrl: PopoverController,
    ) { }

  ngOnInit() {}

  gotoUserLogin() {
    console.debug('more-options#gotoUserLogin');
    this.popOverCtrl.dismiss('user');
  }

  gotoCuratorLogin() {
    console.debug('more-options#gotoCuratorLogin');
    this.popOverCtrl.dismiss('curator');
  }

  gotoEventOwnerLogin() {
    console.debug('more-options#gotoEventOwnerLogin');
    this.popOverCtrl.dismiss('owner');  }

  gotoLanding() {
    console.debug('more-options#gotoLanding');
    this.userDataService.logout();
    this.popOverCtrl.dismiss();
    this.router.navigate([`ui/landing`]);
  }

  switchEvent() {
    console.debug('more-options#switchEvent');
    this.popOverCtrl.dismiss('switch');
  }
}
