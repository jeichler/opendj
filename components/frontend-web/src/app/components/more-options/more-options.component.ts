import { PopoverController } from '@ionic/angular';
import { Component, OnInit } from '@angular/core';
import { Router, NavigationExtras } from '@angular/router';
import { UserDataService } from 'src/app/providers/user-data.service';

@Component({
  selector: 'app-more-options',
  templateUrl: './more-options.component.html',
  styleUrls: ['./more-options.component.scss'],
})
export class MoreOptionsComponent implements OnInit {

  constructor(
    private router: Router,
    public userDataService: UserDataService
  ) { }

  ngOnInit() {}

  gotoUserLogin() {
    console.debug('more-options#gotoUserLogin');
    this.router.navigate([`ui/login-user`], {state: {ctx: 'user'}});
  }

  gotoCuratorLogin() {
    console.debug('more-options#gotoCuratorLogin');
    this.router.navigate([`ui/login-curator`], {state: {ctx: 'curator'}});
  }

  gotoEventOwnerLogin() {
    console.debug('more-options#gotoEventOwnerLogin');
    this.router.navigate([`ui/login-owner`], {state: {ctx: 'owner'}});
  }

  gotoLanding() {
    console.debug('more-options#gotoLanding');
    this.userDataService.logout();
    this.router.navigate([`ui/landing`]);
  }


}
