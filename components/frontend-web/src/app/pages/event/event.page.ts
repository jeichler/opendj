import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Events } from '@ionic/angular';
import { UserDataService } from '../../providers/user-data.service';
import { MusicEvent } from 'src/app/models/music-event';
import { FEService } from 'src/app/providers/fes.service';
import { UserSessionState } from 'src/app/models/usersessionstate';

@Component({
  selector: 'event',
  templateUrl: './event.page.html',
  styleUrls: ['./event.page.scss'],
})
export class EventPage implements OnInit {

  event: MusicEvent;
  userState: UserSessionState;

  constructor(
    public router: Router,
    private events: Events,
    public userDataService: UserDataService,
    public feService: FEService,
    private route: ActivatedRoute,
  ) { }

  joinAsUser() {
    this.userState.currentEventID = this.event.eventID;
    this.userState.isCurator = false;
    this.userState.isEventOwner = false;
  }

  async ngOnInit() {

    this.userState  = await this.userDataService.getUser();
    const eventID = this.route.snapshot.paramMap.get('eventId');
    console.debug(eventID);
    this.event = await this.feService.readEvent(eventID).toPromise();
    console.debug(this.event);

    // redirect to landing page if event doesn't exist
    if (this.event === null) {
      this.router.navigateByUrl('ui/landing');
    }
  }
}
