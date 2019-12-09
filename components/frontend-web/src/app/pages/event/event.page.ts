import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { Events, ModalController, ToastController, AlertController, PopoverController } from '@ionic/angular';
import { UserDataService } from '../../providers/user-data.service';
import { MusicEvent } from 'src/app/models/music-event';
import { FEService } from 'src/app/providers/fes.service';
import { UserSessionState } from 'src/app/models/usersessionstate';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import * as moment from 'moment';
import { UsernameGeneratorService } from 'src/app/providers/username-generator.service';

@Component({
  selector: 'event',
  templateUrl: './event.page.html',
  styleUrls: ['./event.page.scss'],
})
export class EventPage implements OnDestroy, OnInit {

  event: MusicEvent;
  userState: UserSessionState;
  navigationSubscription;
  loginForm: FormGroup;
//  submitAttempt: boolean;

  static getSessionStateForContext(ctx: string, event: MusicEvent, username: string): UserSessionState {
    const state = new UserSessionState();
    const eventID = event.eventID;
    if (ctx === 'user') {
      state.currentEventID = eventID;
      state.isLoggedIn = true;
      state.username = username;
      state.isCurator = event.everybodyIsCurator;
    }
    if (ctx === 'owner') {
      state.currentEventID = eventID;
      state.isLoggedIn = true;
      state.username = username;
      state.isCurator = true;
      state.isEventOwner = true;
    }
    if (ctx === 'curator') {
      state.currentEventID = eventID;
      state.isLoggedIn = true;
      state.username = username;
      state.isCurator = true;
    }
    return state;
  }

  static login(component, event: MusicEvent, ctx: string, username: string, password: string) {
    if (ctx === 'user') {
      component.events.publish('sessionState:modified', EventPage.getSessionStateForContext(ctx, event, username));
      component.router.navigate([`ui/playlist-user`]);
      component.presentToast('You have successfully joined this Event! Start contributing!');
      if (component.dismiss) {
        component.dismiss(null);
      }
    }

    if (ctx === 'owner') {
      if (event.passwordOwner === password && event.owner === username) {
        component.events.publish('sessionState:modified', EventPage.getSessionStateForContext(ctx, event, username));
        component.router.navigate(['ui/create-event']);
        component.presentToast('You have successfully logged in as Event Owner');
        if (component.dismiss) {
          component.dismiss(null);
        }
      } else {
        component.presentToast('Please check your credentials');
      }
    }

    if (ctx === 'curator' ) {
      if (event.passwordCurator === password) {
        component.events.publish('sessionState:modified', EventPage.getSessionStateForContext(ctx, event, username));
        component.router.navigate([`ui/playlist-curator`]);
        component.presentToast('You have successfully joined this Event as Curator. Rock it!!');
        if (component.dismiss) {
          component.dismiss(null);
        }
      } else {
        component.presentToast('Please check your credentials');
      }
    }
  }


  constructor(
    public router: Router,
    private events: Events,
    public userDataService: UserDataService,
    public feService: FEService,
    public usergenerator: UsernameGeneratorService,
    private route: ActivatedRoute,
    public modalController: ModalController,
    public toastController: ToastController,
    public alertController: AlertController,
    public popOverCtrl: PopoverController,
    public formBuilder: FormBuilder,
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

    popover.onDidDismiss().then(info => {
      if ( info !== null && info.data) {
        console.debug('onDidDismiss data=%s', info.data);

        switch (info.data) {
          case 'user':
          case 'curator':
          case 'owner':
            this.presentModal(info.data);
            break;

          case 'switch':
            this.switchEvent();
            break;

          case 'landing':
          this.router.navigate(['ui/landing']);
          break;

          default:
            throw new Error('Unexpected data from more options popover dismis:' + info.data);
        }
      }
    });
    return await popover.present();
  }

  async switchEvent() {
    console.debug('begin switchEvent');

    const popup = await this.alertController.create({
      header: 'Switch Event',
      message: 'Please enter the ID of the event.<br>Look around, it should be advertised at the event location.<br>Ask your host!',
      inputs: [
        {
          name: 'eventID',
          type: 'text',
          placeholder: 'demo'
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary',
        }, {
          text: 'Go!',
          handler: (result) => {
            if (result && result.eventID) {
              console.debug('landing: going to event %s', result.eventID);
              this.router.navigate(['ui/event/' + result.eventID]);
            }
          }
        }
      ]
    });

    await popup.present();
  }


  formatDate(date) {
    return moment(date).format('DD.MM.YYYY | HH:MM');
  }


  join() {
    console.debug('eventPage#join...');
    if (this.loginForm.valid) {
      if (! this.loginForm.value.username) {
        this.generateUsername();
      }
      EventPage.login(this, this.event, 'user', this.loginForm.value.username, this.loginForm.value.password);
    }
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
    console.debug('begin init');
    this.userState = await this.userDataService.getUser();
    const eventID = this.route.snapshot.paramMap.get('eventId');
    try {
      this.event = await this.feService.readEvent(eventID).toPromise();
      console.debug('init event=', this.event);

      // redirect to landing page if event doesn't exist
      if (this.event === null) {
        console.debug('Event not found -> redirect to landing page');
        this.presentToast('SORRY! Event could not be found. Now redirecting to Landing page.');
        this.clearNavSubscription();
        this.router.navigateByUrl('ui/landing');
      }

    } catch (err) {
      console.error('init failed - nav2landing', err);
      this.clearNavSubscription();
      this.router.navigateByUrl('ui/landing');
    }
    console.debug('end init');
  }

  ionViewDidEnter() {
    console.debug('ionViewDidEnter');
  }

  ngOnInit() {
    console.debug('ngOnInit');
    this.loginForm = this.formBuilder.group({
      username: ['', Validators.maxLength(20)],
      password: ['', Validators.nullValidator]
    });
  }

  ngOnDestroy() {
    console.debug('ngOnDestroy');
    this.clearNavSubscription();
  }

  generateUsername() {
    this.loginForm.patchValue({
      username: this.usergenerator.generateUsernameForZoe()
    });
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
    this.popOverCtrl.dismiss('landing');
  }

  switchEvent() {
    console.debug('more-options#switchEvent');
    this.popOverCtrl.dismiss('switch');
  }
}


/**
 * Login Modal
 */
@Component({
  selector: 'app-login-modal',
  templateUrl: './login-modal.component.html',
  styleUrls: ['./login-modal.component.scss'],
})
export class LoginModalComponent implements OnInit {


  // Data passed in by componentProps
  @Input() currentEvent: MusicEvent;
  @Input() context: string;

  loginForm: FormGroup;
  submitAttempt: boolean;



  constructor(
    public modalController: ModalController,
    public feService: FEService,
    public usergenerator: UsernameGeneratorService,
    public formBuilder: FormBuilder,
    private events: Events,
    private router: Router,
    public toastController: ToastController,
  ) {
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

  async dismiss(data) {
    await this.modalController.dismiss(data);
    this.resetForm();
  }

  resetForm() {
    this.loginForm.reset();
  }

  generateUsername() {
    this.loginForm.patchValue({
      username: this.usergenerator.generateUsernameForZoe()
    });
  }

  join() {
    console.debug('loginModal#join...');
    if (this.loginForm.valid) {
      EventPage.login(this, this.currentEvent, this.context, this.loginForm.value.username, this.loginForm.value.password);
    }
  }

  ngOnInit() {
    console.debug('loginModal#ngOnInit');
    this.loginForm = this.formBuilder.group({
      username: ['', Validators.compose([Validators.minLength(3), Validators.maxLength(20), Validators.required])],
      password: ['', Validators.nullValidator]
    });
  }

}
