import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Events, MenuController, Platform } from '@ionic/angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';

import { UserDataService } from './providers/user-data.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss']
})
export class AppComponent implements OnInit {
  loggedIn = false;
  userDetails = { username: '', isCurator: false };

  public appPagesLoggedIn = [
    {
      title: 'Playlist',
      url: '/playlist',
      icon: 'play-circle'
    },
    {
      title: 'Event',
      url: '/event',
      icon: 'play-circle'
    }
  ];

  public appPagesLoggedOut = [
    {
      title: 'Login',
      url: '/login',
      icon: 'log-in'
    }
  ];

  public appPages = [];

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

  async checkLoginStatus() {
    return this.userDataService.isLoggedIn().then(loggedIn => {
      if (loggedIn === null) {
        loggedIn = false;
      } else {
        this.loadUserDetails();
      }
      return this.updateLoggedInStatus(loggedIn);
    });
  }

  private loadUserDetails() {
    this.userDataService.getUsername().then(data => {
      this.userDetails.username = data;
      this.userDataService.getCurator().then(result => {
        this.userDetails.isCurator = result;
      });
    });
  }

  updateLoggedInStatus(loggedIn: boolean) {
    setTimeout(() => {
      this.loggedIn = loggedIn;
      if (this.loggedIn) {
        this.appPages = this.appPagesLoggedIn;
        this.router.navigateByUrl('/playlist', { replaceUrl: true });
      } else {
        this.appPages = this.appPagesLoggedOut;
        this.userDetails = { username: '', isCurator: false };
        this.router.navigateByUrl('/login', { replaceUrl: true });
      }
    }, 300);
  }

  listenForLoginEvents() {
    this.events.subscribe('user:login', data => {
      if (data !== null && data.length === 2) {
        this.userDetails.username = data[0];
        this.userDetails.isCurator = data[1];
      }
      this.updateLoggedInStatus(true);
    });

    this.events.subscribe('user:logout', () => {
      this.updateLoggedInStatus(false);
    });
  }

  logout() {
    this.userDataService.logout().then(() => {
      this.updateLoggedInStatus(false);
    });
  }

  async ngOnInit() {
    this.checkLoginStatus();
    this.listenForLoginEvents();
  }
}
