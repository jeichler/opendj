import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Events } from '@ionic/angular';
import { UserDataService } from '../../providers/user-data.service';
import { FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { MusicEvent } from 'src/app/models/music-event';
import { FEService } from 'src/app/providers/fes.service';
import { timingSafeEqual } from 'crypto';
import { refreshDescendantViews } from '@angular/core/src/render3/instructions';
import { UserSessionState } from 'src/app/models/usersessionstate';

@Component({
  selector: 'app-create-event',
  templateUrl: './create-event.page.html',
  styleUrls: ['./create-event.page.scss'],
})
export class CreateEventPage implements OnInit {

  eventForm: FormGroup;
  event = new MusicEvent();
  userState: UserSessionState;
  submitAttempt: boolean;
  isCreate: boolean;

  constructor(
    public router: Router,
    private events: Events,
    public userDataService: UserDataService,
    public feService: FEService,
    public formBuilder: FormBuilder,
    private route: ActivatedRoute,
  ) { }

  create({ value, valid }: { value: any, valid: boolean }) {
    console.debug('begin create Event');
    console.debug(value);

    if (valid) {
      Object.assign(this.event, value);
      this.event.owner = value.userName;

      this.feService.createEvent(this.event).subscribe((event) => {
        console.debug('Calling server side create event...SUCCESS');
        this.event = event;
        this.mapEventToForm(this.eventForm, this.event);
        this.isCreate = false;

        this.userState = new UserSessionState();
        this.userState.username = event.owner;
        this.userState.currentEventID = this.event.eventID;
        this.userState.isEventOwner = true;
        this.userState.isCurator = true;
        this.userState.isLoggedIn = true;
        this.events.publish('sessionState:modified', this.userState);
      },
      (err) => {
        console.error('Calling server side create event...FAILED', err);
      });
    } else {
      console.debug('Form is not valid, ignoring create request');
    }
  }

  update({ value, valid }: { value: any, valid: boolean }) {
    console.debug('begin update');
    if (valid) {
      console.debug('Calling server side update event...');
      Object.assign(this.event, value);
      this.feService.updateEvent(this.event).subscribe((event) => {
        console.debug('Calling server side update event...SUCCESS');
        this.event = event;
        this.mapEventToForm(this.eventForm, this.event);
        this.isCreate = false;
      },
      (err) => {
        console.error('Calling server side update event...FAILED', err);
      });
    } else {
      console.debug('Form is not valid, ignoring update request');
    }
    console.debug('end update');
  }

  /*
  delete({ value, valid }: { value: any, valid: boolean }) {
    console.debug('begin delete');
    console.debug('Calling server side delete event...');
    this.feService.deleteEvent(value.eventID).subscribe((event) => {
      console.debug('Calling server side delete event...SUCCESS');
      this.event = event;
      this.mapEventToForm(this.eventForm, this.event);
      this.isCreate = true;
    },
    (err) => {
      console.error('Calling server side delete event...FAILED', err);
    });

  }
*/
   validateEventID(eventIDControl: FormControl) {
    console.debug('begin validateEventID eventID=%s', eventIDControl.value);
    const eventID =  eventIDControl.value;
    if (eventID.length >= 3) {
      console.debug('validate with Server');
      this.event.eventID = eventID;
      this.feService.validateEvent(this.event);
    }
    console.debug('end validateEventID');
  }

  mapEventToForm(f: FormGroup, e: MusicEvent) {
    f.patchValue(e);
  }

  async refresh() {
    console.debug('refresh');

    this.userState  = await this.userDataService.getUser();

    if (!this.userState.isLoggedIn) {
      this.event = await this.feService.readEvent(null).toPromise();
      this.isCreate = true;
    }
    if (this.userState.isLoggedIn && this.userState.isEventOwner) {
      this.isCreate = false;
      this.event = await this.feService.readEvent(this.userState.currentEventID).toPromise();
    }
    this.mapEventToForm(this.eventForm, this.event);
  }

  async ionViewDidEnter() {
    await this.refresh();
  }

  async ngOnInit() {

    this.eventForm = this.formBuilder.group({
      eventID: ['', Validators.compose([Validators.minLength(3), Validators.maxLength(12), Validators.pattern('[a-z0-9]*'), Validators.required, this.validateEventID.bind(this)] )],
      name: ['', Validators.compose([Validators.minLength(3), Validators.required])],
      url: ['', Validators.nullValidator],
      maxUsers: ['', Validators.nullValidator],
      userName: ['', Validators.nullValidator],
      passwordOwner: ['', Validators.compose([Validators.minLength(3), Validators.required])],
      passwordCurator: ['', Validators.nullValidator],
      passwordUser: ['', Validators.nullValidator],
      maxDurationInMinutes: ['', Validators.nullValidator],
      maxTracksInPlaylist: ['', Validators.nullValidator],
      eventStartsAt: [new Date().toISOString(), Validators.nullValidator],
      eventEndsAt: ['', Validators.nullValidator],
      allowDuplicateTracks: [false, Validators.nullValidator],
      progressPercentageRequiredForEffectivePlaylist: [false, Validators.nullValidator],
      everybodyIsCurator: [false, Validators.nullValidator],
      pauseOnPlayError: [false, Validators.nullValidator],
      enableTrackLiking: [false, Validators.nullValidator],
      enableTrackHating: [false, Validators.nullValidator],
      demoAutoskip: ['', Validators.nullValidator],
      demoNoActualPlaying: [false, Validators.nullValidator],
      demoAutoFillEmptyPlaylist: [false, Validators.nullValidator]
    });

    // this.refresh();

  }

}
