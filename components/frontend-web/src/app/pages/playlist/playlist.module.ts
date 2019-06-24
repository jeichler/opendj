import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';

import { PlaylistPage, PlaylistAddModalComponent } from './playlist.page';
import { CurrentTrackComponent } from 'src/app/components/current-track/current-track.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild([
      {
        path: '',
        component: PlaylistPage
      }
    ])
  ],
  declarations: [
    PlaylistPage,
    PlaylistAddModalComponent,
    CurrentTrackComponent],
  entryComponents: [
    PlaylistAddModalComponent,
    CurrentTrackComponent
  ]
})
export class PlaylistPageModule { }
