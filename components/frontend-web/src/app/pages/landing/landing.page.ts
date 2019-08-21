import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, MenuController, IonSlides } from '@ionic/angular';
import { createUrlResolverWithoutPackagePrefix } from '@angular/compiler';

@Component({
  selector: '_/landing',
  templateUrl: './landing.page.html',
  styleUrls: ['./landing.page.scss'],
})
export class LandingPage implements OnInit {

  @ViewChild('slides') slides: IonSlides;

  constructor(
    private router: Router,
    public alertController: AlertController,
  ) { }

  createOwnEvent() {
    console.debug('begin createOwnEvent');
    this.router.navigate([`_/login`], {state: {ctx: 'owner'}});
    console.debug('end createOwnEvent');
  }

  skip() {
    this.slides.slideTo(0);
  }

  async joinExistingEvent() {
    console.debug('begin joinExistingEvent');

    const popup = await this.alertController.create({
      header: 'Join Existing Event',
      message: 'Please enter the ID of the event.<br>Look around, it should be advertised at the event location.<br>Ask your host!',
      inputs: [
        {
          name: 'eventID',
          type: 'text',
          placeholder: 'demo'
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary',
        }, {
          text: 'Go!',
          handler: (result) => {
            if (result && result.eventID) {
              console.debug('going to event %s', result.eventID);
              this.router.navigate([`_/login`], {state: {ctx: 'owner', currentEventID: result.eventID}});
              this.router.navigateByUrl('/' + result.eventID, { replaceUrl: true });
            }
          }
        }
      ]
    });

    await popup.present();
    console.debug('end joinExistingEvent');
  }


  ngOnInit() {
  }

}
