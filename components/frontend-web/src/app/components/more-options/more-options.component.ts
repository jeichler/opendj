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
    public userDataService: UserDataService,
    public popOverCtrl: PopoverController,
    ) { }

  ngOnInit() {}

  gotoUserLogin() {
    console.debug('more-options#gotoUserLogin');
    this.popOverCtrl.dismiss('user');
  }

  gotoCuratorLogin() {
    console.debug('more-options#gotoCuratorLogin');
    this.popOverCtrl.dismiss('curator');
  }

  gotoEventOwnerLogin() {
    console.debug('more-options#gotoEventOwnerLogin');
    this.popOverCtrl.dismiss('owner');  }

  gotoLanding() {
    console.debug('more-options#gotoLanding');
    this.userDataService.logout();
    this.popOverCtrl.dismiss();
    this.router.navigate([`ui/landing`]);
  }


}
