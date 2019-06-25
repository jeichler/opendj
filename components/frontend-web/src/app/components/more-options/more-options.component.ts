import { PopoverController } from '@ionic/angular';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

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

  goTo(route: string) {
    this.router.navigateByUrl(`${route}`);
    this.popoverController.dismiss();
  }

}
