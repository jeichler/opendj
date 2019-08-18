import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.page.html',
  styleUrls: ['./landing.page.scss'],
})
export class LandingPage implements OnInit {

  constructor(
    private router: Router,
  ) { }
  
  createOwnEvent() {
    console.debug("begin createOwnEvent");
    this.router.navigateByUrl('/app-event-create', { replaceUrl: true });      
    console.debug("end createOwnEvent");
  }

  joinExistingEvent() {
    console.debug("begin joinExistingEvent");
    // TODO: Ask for EventID using a Popup, then navigate to it:
    let eventID="dan";
    this.router.navigateByUrl('/'+eventID, { replaceUrl: true });      
    console.debug("end joinExistingEvent");
  }


  ngOnInit() {
  }

}
