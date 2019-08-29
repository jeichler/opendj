import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { Events, ModalController, ToastController, AlertController } from '@ionic/angular';
import { UserDataService } from '../../providers/user-data.service';
import { MusicEvent } from 'src/app/models/music-event';
import { FEService } from 'src/app/providers/fes.service';
import { UserSessionState } from 'src/app/models/usersessionstate';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import * as moment from 'moment';

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
    public alertController: AlertController
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
      this.events.publish('user:logout');
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


@Component({
  selector: 'app-login-modal',
  template: `
  <ion-header>
  <ion-toolbar color="opendj">
    <ion-buttons slot="start">
      <ion-button (click)="dismiss(null)">
        <ion-icon slot="icon-only" name="close"></ion-icon>
      </ion-button>
    </ion-buttons>
    <ion-title>
      <span *ngIf="context === 'user'">User Login</span>
      <span *ngIf="context === 'owner'">Owner Login</span>
      <span *ngIf="context === 'curator'">Curator Login</span>
    </ion-title>
  </ion-toolbar>
</ion-header>

<ion-content color="dark">

  <form [formGroup]="loginForm">

    <ion-list lines="none" padding style="background: transparent !important; margin: 0 20px;">

    <ion-item style="--ion-background-color: transparent !important; color: white;">
          <ion-input formControlName="username" type="text" clearInput="true" placeholder="Username">
          </ion-input>
          <ion-note slot="end" *ngIf="context !== 'owner'">
              <ion-button (tap)="generateUsername()" shape="round" color="primary" size="small">
                  <ion-icon name="color-wand"></ion-icon>
              </ion-button>
          </ion-note>
    </ion-item>
    <ion-item *ngIf="!loginForm.controls.username.valid && submitAttempt">
        <p style="color: red;">Minimum length for username is 3.</p>
    </ion-item>

    <ion-item *ngIf="context === 'owner' || context === 'curator' || (context ==='user' && currentEvent.passwordUser !=='')" style="--ion-background-color: transparent !important; color: white;">
        <ion-input formControlName="password" type="password" clearInput="true" placeholder="Password">
        </ion-input>
    </ion-item>

    </ion-list>

    <div style="text-align: center;">
        <ion-button type="submit" shape="round" color="primary" fill="outline" (tap)="join()">
        <span *ngIf="context === 'user'">Join as User</span>
        <span *ngIf="context === 'owner'">Login as Owner</span>
        <span *ngIf="context === 'curator'">Join as Curator</span>
        </ion-button>
    </div>

  </form>

</ion-content>
  `
})
export class LoginModalComponent implements OnInit {

  listOfAnimals = [
    'Alligator', 'Anteater', 'Armadillo', 'Auroch', 'Axolotl', 'Badger', 'Bat', 'Bear', 'Beaver', 'Blobfish', 'Buffalo',
    'Camel', 'Capybara', 'Chameleon', 'Cheetah', 'Chinchilla', 'Chipmunk', 'Chupacabra', 'Cormorant', 'Coyote', 'Crow',
    'Dingo', 'Dinosaur', 'Dog', 'Dolphin', 'Duck', 'DumboOctopus', 'Elephant', 'Ferret', 'Fox', 'Frog',
    'Giraffe', 'Goose', 'Gopher', 'Grizzly', 'Hamster', 'Hedgehog', 'Hippo', 'Hyena',
    'Ibex', 'Ifrit', 'Iguana', 'Jackal', 'Jackalope', 'Kangaroo', 'Kiwi', 'Koala', 'Kraken',
    'Lemur', 'Leopard', 'Liger', 'Lion', 'Llama', 'Loris', 'Manatee', 'Mink', 'Monkey', 'Moose', 'Narwhal',
    'NyanCat', 'Orangutan', 'Otter', 'Panda', 'Penguin', 'Platypus', 'Pumpkin', 'Python', 'Quagga', 'Quokka',
    'Rabbit', 'Raccoon', 'Rhino', 'Sheep', 'Shrew', 'Skunk', 'Squirrel', 'Tiger', 'Turtle', 'Unicorn',
    'Walrus', 'Wolf', 'Wolverine', 'Wombat'
  ];

  // Data passed in by componentProps
  @Input() currentEvent: MusicEvent;
  @Input() context: string;

  loginForm: FormGroup;
  submitAttempt: boolean;


  constructor(
    public modalController: ModalController,
    public feService: FEService,
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

  userNameGeneratorForZoe() {
    const animal = this.listOfAnimals[Math.floor(Math.random() * this.listOfAnimals.length)];
    const num = Math.floor(Math.random() * 100) + 1;
    return 'Anon' + animal + num;
  }

  generateUsername() {
    this.loginForm.patchValue({
      username: this.userNameGeneratorForZoe()
    });
  }

  getSessionStateForContext(): UserSessionState {
    const state = new UserSessionState();
    if (this.context === 'user') {
      state.currentEventID = this.currentEvent.eventID;
      state.isLoggedIn = true;
      state.username = this.loginForm.value.username;
    }
    if (this.context === 'owner') {
      state.currentEventID = this.currentEvent.eventID;
      state.isLoggedIn = true;
      state.username = this.loginForm.value.username;
      state.isCurator = true;
      state.isEventOwner = true;
    }
    if (this.context === 'curator') {
      state.currentEventID = this.currentEvent.eventID;
      state.isLoggedIn = true;
      state.username = this.loginForm.value.username;
      state.isCurator = true;
    }
    return state;
  }

  async join() {
    console.debug('join...');
    if (this.loginForm.valid) {

      if (this.context === 'user') {
        this.events.publish('sessionState:modified', this.getSessionStateForContext());
        this.router.navigate([`ui/playlist-user`]);
        this.presentToast('You have successfully joined this Event! Start contributing!');
        await this.dismiss(null);
      }

      if (this.context === 'owner') {
        if ( this.currentEvent.passwordOwner === this.loginForm.value.password ) {
          this.events.publish('sessionState:modified', this.getSessionStateForContext());
          this.router.navigate(['ui/event/' + this.currentEvent.eventID]);
          this.presentToast('You have successfully loggedin as Event Owner');
          await this.dismiss(null);
        } else {
          this.presentToast('Please check your credentials');
        }
      }

      if (this.context === 'curator' ) {
        if (this.currentEvent.passwordCurator === this.loginForm.value.password) {
          this.events.publish('sessionState:modified', this.getSessionStateForContext());
          this.router.navigate([`ui/playlist-curator`]);
          this.presentToast('You have successfully joined this Event as Curator. Rock it!!');
          await this.dismiss(null);
        } else {
          this.presentToast('Please check your credentials');
        }
      }
    }
  }

  ngOnInit() {
    console.debug('ngOnInit');
    this.loginForm = this.formBuilder.group({
      username: ['', Validators.compose([Validators.minLength(3), Validators.required])],
      password: ['', Validators.nullValidator]
    });
  }
}
