import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, MenuController, IonSlides } from '@ionic/angular';

@Component({
  selector: 'landing',
  templateUrl: './landing.page.html',
  styleUrls: ['./landing.page.scss'],
})
export class LandingPage implements OnInit {

  @ViewChild('slides') slides: IonSlides;
  showSkip = false;

  constructor(
    private router: Router,
    private alertController: AlertController,
  ) { }

  createOwnEvent() {
    this.router.navigate([`ui/create-event`]);
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
          id: 'eventID',
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
// DAN: I think this is a bug that a button cant have and ID like an input:
//          id: 'Go',
          cssClass: 'idForSelenium_Go',

          handler: (result) => {
            let target = 'demo';
            if (result && result.eventID) {
              target = result.eventID;
            }
            console.debug('landing: going to event %s', target);
            this.router.navigate(['ui/event/' + target]);
          }
        }
      ]
    });


    console.debug('before  present');
    popup.present();
    console.debug('end joinExistingEvent');

  }

  hanndleSlideChange() {
    // console.log('Slide change');
    this.slides.getActiveIndex().then((value) => {
      // console.log(value);
      if (value !== 0) {
        this.showSkip = true;
      } else {
        this.showSkip = false;
      }
    });
  }

  ngOnInit() {
  }

}
