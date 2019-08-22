import { PopoverController } from '@ionic/angular';
import { Component, OnInit } from '@angular/core';
import { Router, NavigationExtras } from '@angular/router';

@Component({
  selector: 'app-more-options',
  templateUrl: './more-options.component.html',
  styleUrls: ['./more-options.component.scss'],
})
export class MoreOptionsComponent implements OnInit {

  constructor(
    private router: Router,
    private popoverController: PopoverController
  ) { }

  ngOnInit() {}

  gotoUserLogin() {
    console.debug('more-options#gotoUserLogin');
    this.router.navigate([`_/login`], {state: {ctx: 'user'}});
  }

  gotoCuratorLogin() {
    console.debug('more-options#gotoCuratorLogin');
    this.router.navigate([`_/login`], {state: {ctx: 'curator'}});
  }

  gotoEventOwnerLogin() {
    console.debug('more-options#gotoEventOwnerLogin');
    this.router.navigate([`_/login`], {state: {ctx: 'owner'}});
  }

  gotoLanding() {
    console.debug('more-options#gotoLanding');
   
    this.router.navigate([`_/landing`]);
  }


}
