import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { Events, ModalController } from '@ionic/angular';
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
export class EventPage implements OnInit, OnDestroy {

  event: MusicEvent;
  userState: UserSessionState;
  navigationSubscription;

  constructor(
    public router: Router,
    private events: Events,
    public userDataService: UserDataService,
    public feService: FEService,
    private route: ActivatedRoute,
    public modalController: ModalController
  ) {
    this.navigationSubscription = this.router.events.subscribe((e: any) => {
      if (e instanceof NavigationEnd) {
        console.debug('reinitialise page');
        this.ngOnInit();
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
      if (res.data) {

      }

    });
    return await modal.present();
  }

  formatDate(date) {
    return moment(date).format('DD.MM.YYYY | HH:MM');
  }

  editEvent() {
    console.debug('editEvent');
    this.router.navigateByUrl('/ui/create-event');
  }

  deleteEvent() {
    console.debug('deleteEvent');
    this.feService.deleteEvent(this.event.eventID).subscribe((event) => {
      console.debug('Calling server side delete event...SUCCESS');
      // this.events.publish('user:logout');
    },
      (err) => {
        console.error('Calling server side delete event...FAILED', err);
      });
  }

  logout() {
    this.events.publish('user:logout');
  }

  async init() {

  }

  async ngOnInit() {
    console.debug('initialize');
    this.userState = await this.userDataService.getUser();
    const eventID = this.route.snapshot.paramMap.get('eventId');
    this.event = await this.feService.readEvent(eventID).toPromise();
    console.debug(this.event);

    // redirect to landing page if event doesn't exist
    if (this.event === null) {
      this.router.navigateByUrl('ui/landing');
    }
  }

  ngOnDestroy() {
    if (this.navigationSubscription) {
      this.navigationSubscription.unsubscribe();
    }
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

    <ion-list no-lines padding style="background: transparent !important; margin: 0 20px;">

    <ion-item style="--ion-background-color: transparent !important; color: white;">
          <ion-input formControlName="username" type="text" clearInput="true" autofocus="true" placeholder="Username">
          </ion-input>
          <ion-note slot="end" *ngIf="context !== 'owner'">
              <ion-button (tap)="generateUsername()" shape="round" color="primary" size="small">
                  <ion-icon name="color-wand"></ion-icon>
              </ion-button>
          </ion-note>
    </ion-item>
    <ion-item *ngIf="!loginForm.controls.username.valid  && submitAttempt">
        <p style="color: red;">Minimum length for username is 3.</p>
    </ion-item>

    <ion-item *ngIf="context === 'owner' || context === 'curator' || (context ==='user' && currentEvent.passwordUser !=='')"
    style="--ion-background-color: transparent !important; color: white;">
        <ion-input formControlName="password" type="password" clearInput="true" placeholder="Password">
        </ion-input>
    </ion-item>

    </ion-list>

    <div style="text-align: center;">
        <ion-button type="submit" shape="round" color="primary" fill="outline" (tap)="join(loginForm)">
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
    private router: Router
  ) {
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
    console.debug('join event...');
    if (this.loginForm.valid) {
      if (this.context === 'user') {
        this.events.publish('sessionState:modified', this.getSessionStateForContext());
        this.router.navigate([`ui/playlist-user`]);
      }
      if (this.context === 'owner' && this.currentEvent.passwordOwner === this.loginForm.value.password) {
        this.events.publish('sessionState:modified', this.getSessionStateForContext());
        this.router.navigate(['ui/event/' + this.currentEvent.eventID]);
      }
      if (this.context === 'curator' && this.currentEvent.passwordCurator === this.loginForm.value.password) {
        this.events.publish('sessionState:modified', this.getSessionStateForContext());
        this.router.navigate([`ui/playlist-curator`]);
      }
      await this.dismiss(null);
    }
  }

  ngOnInit() {
    console.debug(this.currentEvent);
    console.debug(this.context);
    this.loginForm = this.formBuilder.group({
      username: ['', Validators.compose([Validators.minLength(3), Validators.required])],
      password: ['', Validators.nullValidator]
    });
  }
}
