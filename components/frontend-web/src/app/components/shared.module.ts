import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ReactiveFormsModule } from '@angular/forms';
import { CurrentTrackComponent } from './current-track/current-track.component';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule
  ],
  declarations: [ CurrentTrackComponent ],
  exports: [ CurrentTrackComponent ]
})
export class SharedModule {}
