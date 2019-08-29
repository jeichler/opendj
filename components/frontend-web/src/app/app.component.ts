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

  // userState is important for displaying the menu options
  userState = new UserSessionState();

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
    this.registerEventSubscribers();
  }

  initializeApp() {
    this.platform.ready().then((readySource) => {
      console.debug(`Running on Platform: ${readySource}`);

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

  registerEventSubscribers() {
    console.debug('registerEventSubscribers');

    this.events.subscribe('sessionState:modified', state => {
      console.debug('Received sessionState:modified event');
      this.userState = state;
      this.userDataService.updateUser(state);
    });

    this.events.subscribe('user:logout', data => {
      console.debug('Received user:logout event');
      this.userState = new UserSessionState();
      this.userDataService.updateUser(this.userState);
      this.router.navigate([`ui/landing`]);
    });

  }

  logout() {
    this.events.publish('user:logout');
  }

  async ngOnInit() {
    console.debug('ngOnInit()');
    await this.loadUserState();
  }

}
