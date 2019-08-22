import { Injectable } from '@angular/core';
import { Events } from '@ionic/angular';
import { Storage } from '@ionic/storage';
import { UserSessionState } from '../models/usersessionstate';


@Injectable({
  providedIn: 'root'
})
export class UserDataService {
  HAS_LOGGED_IN = 'hasLoggedIn';
  IS_CURATOR = 'isCurator';
  USERNAME = 'username';

  constructor(
    public events: Events,
    public storage: Storage
  ) { }

  getUser(): Promise<UserSessionState> {
    console.debug('UserDataService#getUser');
    return this.storage.get('USER').then((value) => {
      if (!value) {
        console.debug('user-data-service#getUser(): not found in storage, returning new one');
        value = new UserSessionState();
      }
      return value;
    });
  }

  updateUser(u: UserSessionState) {
    console.debug('UserDataService#updateUser');
    this.storage.set('USER',u).catch((err) => {
      console.error('user-data-service#updateUser failed',err);
    });
  }

  logout() {
    console.debug('UserDataService#logout');
    this.storage.clear();
  }

/*

  login(username: string, isCurator: boolean): Promise<any> {
    return this.storage.set(this.HAS_LOGGED_IN, true).then(() => {
      this.setUsername(username);
      this.setCurator(isCurator);
    });
  }

  logout(): Promise<any> {
    return this.storage.remove(this.HAS_LOGGED_IN).then(() => {
      this.storage.remove(this.USERNAME);
      this.storage.remove(this.IS_CURATOR);
    }).then(() => {
      // this.events.publish('user:logout');
    });
  }

  setUsername(username: string): Promise<any> {
    return this.storage.set(this.USERNAME, username);
  }

  getUsername(): Promise<string> {
    return this.storage.get(this.USERNAME).then((value) => {
      return value;
    });
  }

  setCurator(isCurator: boolean): Promise<any> {
    return this.storage.set(this.IS_CURATOR, isCurator);
  }

  getCurator(): Promise<boolean> {
    return this.storage.get(this.IS_CURATOR).then((value) => {
      return value;
    });
  }

  isLoggedIn(): Promise<boolean> {
    return this.storage.get(this.HAS_LOGGED_IN).then((value) => {
      return value;
    });
  }
*/
}
