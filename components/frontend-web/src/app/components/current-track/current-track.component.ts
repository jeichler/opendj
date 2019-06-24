import { Component, OnInit, Input } from '@angular/core';
import { Track } from 'src/app/models/track';


@Component({
  selector: 'app-current-track',
  templateUrl: './current-track.component.html',
  styleUrls: ['./current-track.component.scss'],
})
export class CurrentTrackComponent implements OnInit {

  @Input() track: Track;

  constructor() { }

  async ngOnInit() {
    console.log(this.track);
  }

}
