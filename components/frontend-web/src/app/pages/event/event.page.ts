import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
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

  userEvent: string;
  event: MusicEvent;

  constructor(
    public router: Router,
    private route: ActivatedRoute,
    private events: Events,
    public userDataService: UserDataService,
    public formBuilder: FormBuilder
  ) { }

  ngOnInit() {

    this.userEvent = this.route.snapshot.paramMap.get('userEvent');
    // TODO: load the specific User Event....

  }

}
