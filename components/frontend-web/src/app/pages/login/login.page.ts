import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Events, AlertController } from '@ionic/angular';
import { UserDataService } from '../../providers/user-data.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PopoverController } from '@ionic/angular';
import { MoreOptionsComponent } from '../../components/more-options/more-options.component';
import { UserSessionState } from 'src/app/models/usersessionstate';
import { MusicEvent } from 'src/app/models/music-event';
import { FEService } from 'src/app/providers/fes.service';
import { map } from 'rxjs/operators';

const listOfAnimals = [
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

/*
Contexts:

1. EventID Unknown - Create Event Owner (basically register), email, no password (will be set in edit event dialog) --> Redirect to EVENT Page (CREATE Mode)
2. EventID Known - Login as Owner - Login-Event für Event Owner (eMail+pswd), validate against event --> Redirect to EVENT Page  (EDIT Mode)
3. EventID Known - Login as Curator - Validate against event, except everybody is curator --> Redirect to playlist-curator page
4. EventID Known - Login as User - Login-Event für User (Anon, userPswd if event has user pswd)

IF Event is known but does not exist, show popup with error message, maybe option to create event

EventID can be passed as navParam OR as routeParam
LoginContext (Owner, Curator, User) is passed as navigationExtras. Default: User
( see more-options component for example)

if user is already present - re-use that

TODO: App Menu:
Users -> Login as Curator, Login as Event Owner
Curatos -> Login as Event Owner
*/




@Component({
  selector: 'login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {

  loginForm: FormGroup;
  submitAttempt: boolean;

  ctxIsOwner = false;
  ctxIsCurator = false;
  ctxIsUser = false;
  ctxIsEventKnown = false;

  currentUser: UserSessionState;
  currentEvent: MusicEvent;


  constructor(
    public router: Router,
    public route: ActivatedRoute,
    public feService: FEService,
    public userDataService: UserDataService,
    public popOverCtrl: PopoverController,
    public alertController: AlertController,
    public formBuilder: FormBuilder
  ) { }

  userIsNowLoggedIn() {
    console.debug('userIsNowLoggedIn');
    this.currentUser.username = this.loginForm.value.username;
    this.currentUser.isLoggedIn = true;
    this.userDataService.updateUser(this.currentUser);
  }

  gotoEvent() {
    console.debug('gotoEvent()');
    this.currentUser.isEventOwner = true;
    this.currentUser.isCurator = true;
    this.userIsNowLoggedIn();
    this.router.navigate([`ui/event`]);
  }
  gotoCurator() {
    console.debug('gotoCurator()');
    this.currentUser.isEventOwner = false;
    this.currentUser.isCurator = true;
    this.userIsNowLoggedIn();
    this.router.navigate([`ui/playlist-curator`]);
  }

  gotoUser() {
    console.debug('gotoUser()');
    this.currentUser.isEventOwner = false;
    this.currentUser.isCurator = false;
    this.userIsNowLoggedIn();
    this.router.navigate([`ui/playlist-user`]);
  }

  wrongPassword() {
    this.loginForm.controls.password.setErrors({invalidKey: true});
  }

  loginOwner() {
    console.debug('loginOwner()');
    if (this.loginForm.valid) {
      if (this.ctxIsEventKnown) {
        if (this.currentEvent.passwordOwner) {
          if (this.loginForm.value.password === this.currentEvent.passwordOwner) {
            console.debug('correct owner password');
            this.gotoEvent();
          } else {
            console.debug('wrong owner password');
            this.wrongPassword();
          }
        } else {
          console.debug('event does not require owner password?!');
          this.gotoEvent();
        }
      } else {
        this.gotoEvent();
      }
    }
  }

  loginCurator() {
    console.debug('loginCurator()');
    if (this.loginForm.valid) {
      if (this.ctxIsEventKnown) {
        if (this.currentEvent.passwordCurator) {
          if (this.loginForm.value.password === this.currentEvent.passwordCurator) {
            console.debug('correct curator password');
            this.gotoCurator();
          } else {
            console.debug('wrong curator password');
            this.wrongPassword();
          }
        } else {
          console.debug('event does not require curator password');
          this.gotoCurator();
        }
      } else {
        console.error('loginUser() - event unknown - this should not happend?!');
      }
    }
  }

  loginUser() {
    console.debug('loginUser()');
    if (this.loginForm.valid) {
      if (this.ctxIsEventKnown) {
        if (this.currentEvent.passwordUser) {
          if (this.loginForm.value.password === this.currentEvent.passwordUser) {
            console.debug('correct user password');
            this.gotoUser();
          } else {
            console.debug('wrong user password');
            this.wrongPassword();
          }
        } else {
          console.debug('event does not require user password');
          this.gotoUser();
        }
      } else {
        console.error('loginUser() - event unknown - this should not happend?!');
      }
    }
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
        this.setContextFromString(newCtx.data);
      }
    });
    return await popover.present();
  }

  userNameGeneratorForZoe() {
    const animal = listOfAnimals[Math.floor(Math.random() * listOfAnimals.length)];
    const num = Math.floor(Math.random() * 100) + 1;
    return 'Anon' + animal + num;
  }

  generateUsername() {
    this.loginForm.patchValue({
      username: this.userNameGeneratorForZoe()
    });
  }

  setContextFromString(ctx: string) {
    console.debug('setContext %s', ctx);
    this.ctxIsUser = this.ctxIsCurator = this.ctxIsOwner = false;
    switch (ctx) {
      case 'user':
        this.ctxIsUser = true;
        break;
      case 'curator':
        this.ctxIsCurator = true;
        break;
      case 'owner':
        this.ctxIsOwner = true;
        break;
      default:
        throw new Error('Unknown login context ' + ctx);
    }
  }

  async handleEventDoesNotExists(eventID: string) {
    console.debug('begin handleEventDoesNotExists');
    const popup = await this.alertController.create({
      header: 'Oh no!!',
      message: 'We couldn\'t find this event ?!?',
      inputs: [
        {
          name: 'eventID',
          type: 'text',
          placeholder: eventID
        },
      ],
      buttons: [
        {
          text: '',
          role: 'cancel',
          cssClass: 'secondary',
          handler: () => {
              // TODO:
              // Logoff? - clear user state
              // Redirect to landing?
              throw new Error('Implement me!');
          }
        }, {
          text: 'Search again?!',
          handler: (result) => {
            if (result && result.eventID) {
              throw new Error('Implement me!');
            }
          }
        }, {
          text: 'Create this event!',
          handler: (result) => {
            if (result && result.eventID) {
              throw new Error('Implement me!');
            }
          }
        }
      ]
    });

    await popup.present();

    console.debug('end handleEventDoesNotExists');
  }

  ngOnInit() {
    console.debug('begin loginPage#ngOnInit()');
    this.loginForm = this.formBuilder.group({
      username: ['', Validators.compose([Validators.minLength(3), Validators.required])],
      password: ['', Validators.nullValidator]
    });
  }

  async ionViewDidEnter() {
    console.debug('begin loginPage#ngOnEnter()');

    console.debug('checking on user...');
    this.currentUser = await this.userDataService.getUser();

    console.debug('checking on what window.history.state has for us');
    if (window.history
        && window.history.state) {
        const navState = window.history.state;
        console.debug('navState = %s', JSON.stringify(navState));
        if (navState.ctx) {
          console.debug('got context %s from nav extras state', navState.ctx);
          this.setContextFromString(navState.ctx);
        } else {
          console.debug('NO context from nav extras state - using default user');
          this.setContextFromString('user');
        }

        if (navState.currentEventID) {
          console.debug('got currentEventID %s from nav extras state', navState.currentEventID);
          this.currentUser.currentEventID = navState.currentEventID;
        }
    } else {
      console.debug('nav extras state not available - assuming ctx=user');
      this.setContextFromString('user');
    }

    if (!this.currentUser.currentEventID) {
      console.debug('got no eventID out ouf nav extras state- checking route paramMap');
      const eventID = this.route.snapshot.paramMap.get('userEventID');
      if (eventID) {
        console.debug('got eventID >%s< from route param Map', eventID);
        this.currentUser.currentEventID = eventID;
      } else {
        console.debug('no eventID from route param Map');
      }
    }

    this.userDataService.updateUser(this.currentUser);

    console.debug('checking on currentEventID >%s<', this.currentUser.currentEventID);
    if (this.currentUser.currentEventID) {
      console.debug('Loading event...');
      this.currentEvent = await this.feService.readEvent(this.currentUser.currentEventID).toPromise();
      if (this.currentEvent) {
        console.debug('Loading event...OK');
        console.debug(this.currentEvent);
        this.ctxIsEventKnown = true;
      } else {
        console.debug('Loading event...NOT FOUND');
        this.ctxIsEventKnown = false;
        this.handleEventDoesNotExists(this.currentUser.currentEventID);
      }
    } else {
      console.debug('no currentEventID - switching to ctx owner');
      this.ctxIsEventKnown = false;
      this.setContextFromString('owner');
    }

    console.debug('end loginPage#ngOnEnter()');
  }

  ionViewDidLeave() {
    console.debug('login page leave');
//    this.popOverCtrl.dismiss();
  }


}
