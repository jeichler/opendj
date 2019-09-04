import { Component, OnInit, Input } from '@angular/core';
import { UserSessionState } from 'src/app/models/usersessionstate';
import { MusicEvent } from 'src/app/models/music-event';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { ModalController, Events, ToastController } from '@ionic/angular';
import { FEService } from 'src/app/providers/fes.service';
import { Router } from '@angular/router';
import { UsernameGeneratorService } from 'src/app/providers/username-generator.service';

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
