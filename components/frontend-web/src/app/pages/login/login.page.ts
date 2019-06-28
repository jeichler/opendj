import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Events } from '@ionic/angular';
import { UserDataService } from '../../providers/user-data.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PopoverController } from '@ionic/angular';
import { MoreOptionsComponent } from '../../components/more-options/more-options.component';
const ung = require('username-generator');


@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {

  loginForm: FormGroup;
  submitAttempt: boolean;

  constructor(
    public router: Router,
    private events: Events,
    public userDataService: UserDataService,
    public popOverCtrl: PopoverController,
    public formBuilder: FormBuilder
  ) { }

   loginAction() {
    this.submitAttempt = true;
    if (!this.loginForm.valid) {
      return;
    } else {
      this.userDataService.login(this.loginForm.value.username, false).then(data => {
        this.events.publish('user:login', [this.loginForm.value.username, false]);
      });
    }
  }

  async presentMoreOptions(ev: any) {
    const popover = await this.popOverCtrl.create({
      component: MoreOptionsComponent,
      event: ev,
      translucent: true
    });
    return await popover.present();
  }

  generateUsername() {
    this.loginForm.patchValue({
      username: ung.generateUsername()
    });
  }

  ngOnInit() {
    this.loginForm = this.formBuilder.group({
      username: ['', Validators.compose([Validators.minLength(3), Validators.required])]
    });
    this.generateUsername();
  }

}
