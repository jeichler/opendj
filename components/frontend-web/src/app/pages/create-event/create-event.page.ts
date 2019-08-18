import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Events } from '@ionic/angular';
import { UserDataService } from '../../providers/user-data.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MusicEvent } from 'src/app/models/music-event';
import { FEService } from 'src/app/providers/fes.service';
import { timingSafeEqual } from 'crypto';
import { refreshDescendantViews } from '@angular/core/src/render3/instructions';

@Component({
  selector: 'app-create-event',
  templateUrl: './create-event.page.html',
  styleUrls: ['./create-event.page.scss'],
})
export class CreateEventPage implements OnInit {

  eventForm: FormGroup;
  event: MusicEvent;
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
    console.debug("begin create");
  
    if (valid) {
      console.debug("Calling server side create event...");
      Object.assign(this.event, value);
      this.feService.createEvent(this.event).subscribe((event) => {
        console.debug("Calling server side create event...SUCCESS");
        this.event = event;
        this.mapEventToForm(this.eventForm, this.event);
        this.isCreate = false;
      },
      (err) => {
        console.error("Calling server side create event...FAILED", err);
      });
    } else {
      console.debug("Form is not valid, ignoring create request");
    }
    console.debug("end create");
  }

  update({ value, valid }: { value: any, valid: boolean }) {
    console.debug("begin update");
    if (valid) {
      console.debug("Calling server side update event...");
      Object.assign(this.event, value);
      this.feService.updateEvent(this.event).subscribe((event) => {
        console.debug("Calling server side update event...SUCCESS");
        this.event = event;
        this.mapEventToForm(this.eventForm, this.event);
        this.isCreate = false;
      },
      (err) => {
        console.error("Calling server side update event...FAILED", err);
      });
    } else {
      console.debug("Form is not valid, ignoring update request");
    }
    console.debug("end update");
  }

  delete({ value, valid }: { value: any, valid: boolean }) {
    console.debug("begin delete");
    console.debug("Calling server side delete event...");
    this.feService.deleteEvent(value.eventID).subscribe((event) => {
      console.debug("Calling server side delete event...SUCCESS");
      this.event = event;
      this.mapEventToForm(this.eventForm, this.event);
      this.isCreate = true;
    },
    (err) => {
      console.error("Calling server side delete event...FAILED", err);
    });
  
  }
  enterEvent({ value, valid }: { value: any, valid: boolean }) {
    console.debug("begin enterEvent - navigating to playlist");
  
    this.router.navigateByUrl('/'+this.event.eventID +'/playlist-user', { replaceUrl: true });      

    console.debug("end enterEvent");
  
  }

  async refresh() {
    console.debug("begin refresh");
  
    let eventID = this.route.snapshot.paramMap.get('userEventID');
    if (eventID) {
      console.debug("Get Event %s from server", eventID);
      this.event = await this.feService.readEvent(eventID).toPromise();
      if (this.event) {
        console.debug("Event from Server received");
        this.isCreate = false;
      } else {
        console.info("Event %s not found on server", eventID);  
        // TODO: Redirect to Landing Page

        // For testing purposes, we switch into create mode:
        this.event = await this.feService.readEvent(null).toPromise();
        this.event.eventID = eventID;
        this.event.name = eventID;
        this.event.url="www.opendj.io/"+eventID;
        this.isCreate = true;
        }
    } else {
      console.debug("Did not receive an event ID - get default from server for create");
      this.event = await this.feService.readEvent(null).toPromise();
      this.isCreate = true;
    }
    console.debug("Map Event to Form: %s", JSON.stringify(this.event));
    this.mapEventToForm(this.eventForm, this.event);


    console.debug("end refresh");
  }

  mapEventToForm(f: FormGroup, e: MusicEvent) {
    f.patchValue(e);
  /*  
    f.get('eventID').setValue(e.eventID);
    f.get('name').setValue(e.name);
    f.get('url').setValue(e.url);
    f.get('maxUsers').setValue(e.maxUsers);
    f.get('maxDurationInMinutes').setValue(e.maxDurationInMinutes);
    f.get('maxTracksInPlaylist').setValue(e.maxTracksInPlaylist);
    f.get('eventStartsAt').setValue(e.eventStartsAt);
    f.get('eventEndsAt').setValue(e.eventEndsAt);
    f.get('allowDuplicateTracks').setValue(e.allowDuplicateTracks);
    f.get('progressPercentageRequiredForEffectivePlaylist').setValue(e.progressPercentageRequiredForEffectivePlaylist);
    f.get('everybodyIsCurator').setValue(e.everybodyIsCurator);
    f.get('pauseOnPlayError').setValue(e.pauseOnPlayError);
    f.get('enableTrackLiking').setValue(e.enableTrackLiking);
    f.get('enableTrackHating').setValue(e.enableTrackHating);
    f.get('demoAutoskip').setValue(e.demoAutoskip);
    f.get('demoNoActualPlaying').setValue(e.demoNoActualPlaying);
    f.get('demoAutoFillEmptyPlaylist').setValue(e.demoAutoFillEmptyPlaylist);
  */
  }

  ngOnInit() {

    this.eventForm = this.formBuilder.group({
      eventID: ['', Validators.required],
      name: ['', Validators.compose([Validators.minLength(3), Validators.required])],
      url: ['', Validators.required],
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
