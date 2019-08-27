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
//  submitAttempt: boolean;
  isCreate: boolean;

  constructor(
    public router: Router,
    private events: Events,
    public userDataService: UserDataService,
    public feService: FEService,
    public formBuilder: FormBuilder,
    private route: ActivatedRoute,
  ) { }

  /*
  resetForm() {
    console.log('resetting form');
    this.submitAttempt = false;
    this.event = new MusicEvent;
    this.eventForm.reset();

    this.eventForm.patchValue({
      eventID: '4711',
      eventStartsAt: new Date().toISOString(),
      allowDuplicateTracks: false
    });
  }
  */

  create({ value, valid }: { value: any, valid: boolean }) {
    console.debug('begin create');

    if (valid) {
      console.debug('Calling server side create event...');
      Object.assign(this.event, value);
      this.event.owner = this.userState.username;
      this.feService.createEvent(this.event).subscribe((event) => {
        console.debug('Calling server side create event...SUCCESS');
        this.event = event;
        this.mapEventToForm(this.eventForm, this.event);
        this.isCreate = false;
        this.userState.currentEventID = this.event.eventID;
        this.userState.isEventOwner = true;
        this.userDataService.updateUser(this.userState);
      },
      (err) => {
        console.error('Calling server side create event...FAILED', err);
      });
    } else {
      console.debug('Form is not valid, ignoring create request');
    }
    console.debug('end create');
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
  enterEvent({ value, valid }: { value: any, valid: boolean }) {
    console.debug('begin enterEvent - navigating to playlist');
    this.router.navigate([`ui/playlist-user`]);
    console.debug('end enterEvent');

  }

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


  async refresh() {
    console.debug('begin refresh');

    this.userState  = await this.userDataService.getUser();
    const eventID = this.userState.currentEventID;

    if (eventID) {
      console.debug('Get Event %s from server', eventID);
      this.event = await this.feService.readEvent(eventID).toPromise();
      if (this.event) {
        console.debug('Event from Server received');
        this.isCreate = false;
      } else {
        console.info('Event %s not found on server', eventID);
        // TODO: Redirect to Landing Page

        // For testing purposes, we switch into create mode:
        this.event = await this.feService.readEvent(null).toPromise();
        this.event.eventID = eventID;
        this.event.name = eventID;
        this.event.url = 'www.opendj.io/' + eventID;
        this.isCreate = true;
        }
    } else {
      console.debug('Did not receive an event ID - get default from server for create');
      this.event = await this.feService.readEvent(null).toPromise();
      this.isCreate = true;
    }
    console.debug('Map Event to Form: %s', JSON.stringify(this.event));
    this.mapEventToForm(this.eventForm, this.event);


    console.debug('end refresh');
  }

  mapEventToForm(f: FormGroup, e: MusicEvent) {
    f.patchValue(e);
  }

  ngOnInit() {

    this.eventForm = this.formBuilder.group({
      eventID: ['', Validators.compose([Validators.minLength(3), Validators.maxLength(12), Validators.pattern('[a-z0-9]*'), Validators.required, this.validateEventID.bind(this)] )],
      name: ['', Validators.compose([Validators.minLength(3), Validators.required])],
      url: ['', Validators.nullValidator],
      maxUsers: ['', Validators.nullValidator],
      passwordOwner: ['', Validators.nullValidator],
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

    this.refresh();
  }

}
