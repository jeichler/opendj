import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Events } from '@ionic/angular';
import { UserDataService } from '../../providers/user-data.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MusicEvent } from 'src/app/models/music-event';

@Component({
  selector: 'app-event',
  templateUrl: './event.page.html',
  styleUrls: ['./event.page.scss'],
})
export class EventPage implements OnInit {

  eventForm: FormGroup;
  event: MusicEvent;

  constructor(
    public router: Router,
    private events: Events,
    public userDataService: UserDataService,
    public formBuilder: FormBuilder
  ) { }

  ngOnInit() {
    this.event = new MusicEvent();
    this.event.eventID = "4711";
    this.event.eventStartsAt = new Date().toISOString();

    this.eventForm = this.formBuilder.group({
      eventID: ['', Validators.required],
      name: ['', Validators.compose([Validators.minLength(3), Validators.required])],
      url: ['', Validators.required],
      maxUsers: ['', Validators.nullValidator],
      maxDurationInMinutes: ['', Validators.nullValidator],
      maxTracksInPlaylist: ['', Validators.nullValidator],
      eventStartsAt: ['', Validators.nullValidator],
      eventEndsAt: ['', Validators.nullValidator],
      allowDuplicateTracks: ['', Validators.nullValidator],
      progressPercentageRequiredForEffectivePlaylist: ['', Validators.nullValidator],
      everybodyIsCurator: ['', Validators.nullValidator],
      pauseOnPlayError: ['', Validators.nullValidator],
      enableTrackLiking: ['', Validators.nullValidator],
      enableTrackHating: ['', Validators.nullValidator],
      demoAutoskip: ['', Validators.nullValidator],
      demoNoActualPlaying: ['', Validators.nullValidator],
      demoAutoFillEmptyPlaylist: ['', Validators.nullValidator],

      //      username: ['', Validators.compose([Validators.minLength(3), Validators.required])],

    });

  }

}
