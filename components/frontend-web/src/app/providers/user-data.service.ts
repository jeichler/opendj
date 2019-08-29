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
    console.debug('getUser');
    return this.storage.get('USER').then((value) => {
      if (!value) {
        console.debug('getUser -> state not found in local storage, returning new state');
        value = new UserSessionState();
      }
      return value;
    });
  }

  updateUser(u: UserSessionState) {
    console.debug('updateUser');
    this.storage.set('USER', u).then( () => {
      this.events.publish('user:modified', u);
    }).catch((err) => {
      console.error('updateUser -> failed', err);
    });
  }

  logout() {
    console.debug('logout');
    this.storage.clear().then( () => {
    });
    }

}
