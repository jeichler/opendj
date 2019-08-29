import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { CurrentTrackComponent } from './current-track/current-track.component';
import { PlaylistItemComponent } from './playlist-item/playlist-item.component';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    FormsModule
  ],
  declarations: [ CurrentTrackComponent, PlaylistItemComponent ],
  exports: [ CurrentTrackComponent, PlaylistItemComponent ]
})
export class SharedModule {}
