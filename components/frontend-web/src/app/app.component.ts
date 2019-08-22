import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Events, MenuController, Platform } from '@ionic/angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';

import { UserDataService } from './providers/user-data.service';
import { UserSessionState } from './models/usersessionstate';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss']
})
export class AppComponent implements OnInit {
  userState: UserSessionState;

  constructor(
    public platform: Platform,
    private splashScreen: SplashScreen,
    private statusBar: StatusBar,
    private events: Events,
    private router: Router,
    private menu: MenuController,
    private userDataService: UserDataService
  ) {
    this.initializeApp();
  }

  initializeApp() {
    this.platform.ready().then((readySource) => {
      console.log(`Platform: ${readySource}`);

      if (readySource === 'cordova') {
        this.statusBar.styleDefault();
        this.splashScreen.hide();
      }
    });
  }

  private async loadUserState() {
    console.debug('loadUserState');
    this.userState = await this.userDataService.getUser();
  }
  private async saveUserState() {
    console.debug('saveUserState');
    await this.userDataService.updateUser(this.userState);
  }

  logout() {
    this.userDataService.logout();
    this.router.navigate([`ui/login`]);
  }

  async ngOnInit() {
    console.debug('begin ngOnInit()');
    await this.loadUserState();
    console.debug('end ngOnInit()');
  }

}
