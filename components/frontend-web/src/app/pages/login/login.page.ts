import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Events } from '@ionic/angular';
import { UserDataService } from '../../providers/user-data.service';
import { EnvService } from '../../providers/env.service';

import { PopoverController } from '@ionic/angular';
import { MoreOptionsComponent } from '../../components/more-options/more-options.component';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {

  login = { username: '', curatorPassword: '' };
  submitted = false;

  constructor(
    public router: Router,
    private events: Events,
    public userDataService: UserDataService,
    public envService: EnvService,
    public popOverCtrl: PopoverController
  ) { }

  onLogin() {
    console.log('login...' + JSON.stringify(this.login));
    let isCurator = false;
    if (this.login.curatorPassword === this.envService.curatorPassword) {
      isCurator = true;
    }
    this.userDataService.login(this.login.username, isCurator).then(data => {
      this.events.publish('user:login', [this.login.username, isCurator]);
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
  }

}
