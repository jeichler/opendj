import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Events } from '@ionic/angular';
import { UserDataService } from '../../providers/user-data.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MusicEvent } from 'src/app/models/music-event';

@Component({
  selector: 'app-create-event',
  templateUrl: './create-event.page.html',
  styleUrls: ['./create-event.page.scss'],
})
export class CreateEventPage implements OnInit {

  eventForm: FormGroup;
  event: MusicEvent;
  submitAttempt: boolean;

  constructor(
    public router: Router,
    private events: Events,
    public userDataService: UserDataService,
    public formBuilder: FormBuilder
  ) { }

  resetForm() {
    console.log('resetting form');
    this.submitAttempt = false;
    this.event = null;
    this.eventForm.reset();

    this.eventForm.patchValue({
      eventID: '4711',
      eventStartsAt: new Date().toISOString(),
      allowDuplicateTracks: false
    });
  }

  submit({ value, valid }: { value: any, valid: boolean }) {
    this.submitAttempt = true;
    if (!valid) {
        return;
    } else {
      this.event = value;
      console.log(this.event);
      // TODO: create the event in the backend....

      this.resetForm();
    }
  }

  ngOnInit() {

    this.eventForm = this.formBuilder.group({
      eventID: ['4711', Validators.required],
      name: ['', Validators.compose([Validators.minLength(3), Validators.required])],
      url: ['', Validators.required],
      maxUsers: ['', Validators.nullValidator],
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

  }
}
