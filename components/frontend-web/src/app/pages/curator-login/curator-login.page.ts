import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Events, PopoverController } from '@ionic/angular';
import { UserDataService } from 'src/app/providers/user-data.service';
import { EnvService } from 'src/app/providers/env.service';
import { MoreOptionsComponent } from 'src/app/components/more-options/more-options.component';

@Component({
  selector: 'app-curator-login',
  templateUrl: './curator-login.page.html',
  styleUrls: ['./curator-login.page.scss'],
})
export class CuratorLoginPage implements OnInit {

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
