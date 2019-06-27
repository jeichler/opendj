import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Events, PopoverController } from '@ionic/angular';
import { UserDataService } from 'src/app/providers/user-data.service';
import { EnvService } from 'src/app/providers/env.service';
import { MoreOptionsComponent } from 'src/app/components/more-options/more-options.component';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
const ung = require('username-generator');

@Component({
  selector: 'app-curator-login',
  templateUrl: './curator-login.page.html',
  styleUrls: ['./curator-login.page.scss'],
})
export class CuratorLoginPage implements OnInit {

  loginForm: FormGroup;
  submitAttempt: boolean;

  constructor(
    public router: Router,
    private events: Events,
    public userDataService: UserDataService,
    public envService: EnvService,
    public popOverCtrl: PopoverController,
    public formBuilder: FormBuilder
  ) { }

  loginAction() {
    this.submitAttempt = true;
    if (this.envService.curatorPassword !== this.loginForm.value.curatorKey) {
      this.loginForm.controls.curatorKey.setErrors({invalidKey: true});
    }
    if (!this.loginForm.valid) {
      return;
    } else {
      this.userDataService.login(this.loginForm.value.username, true).then(data => {
        this.events.publish('user:login', [this.loginForm.value.username, true]);
      });
    }
  }

  generateUsername() {
    this.loginForm.patchValue({
      username: ung.generateUsername()
    });
  }

  async presentMoreOptions(ev: any) {
    const popover = await this.popOverCtrl.create({
      component: MoreOptionsComponent,
      event: ev,
      translucent: true
    });
    return await popover.present();
  }

  ngOnInit() {
    this.loginForm = this.formBuilder.group({
      username: ['', Validators.compose([Validators.minLength(3), Validators.required])],
      curatorKey: ['', Validators.compose([Validators.required])]
    });
    this.generateUsername();
  }

}
