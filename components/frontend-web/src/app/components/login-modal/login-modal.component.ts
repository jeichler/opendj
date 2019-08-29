import { Component, OnInit, Input } from '@angular/core';
import { UserSessionState } from 'src/app/models/usersessionstate';
import { MusicEvent } from 'src/app/models/music-event';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { ModalController, Events, ToastController } from '@ionic/angular';
import { FEService } from 'src/app/providers/fes.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login-modal',
  templateUrl: './login-modal.component.html',
  styleUrls: ['./login-modal.component.scss'],
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
