import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { MoreOptionsComponent } from 'src/app/components/more-options/more-options.component';
import { FormsModule } from '@angular/forms';
import { CurrentTrackComponent } from './current-track/current-track.component';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    FormsModule
  ],
  declarations: [ MoreOptionsComponent, CurrentTrackComponent ],
  exports: [ MoreOptionsComponent, CurrentTrackComponent ]
})
export class SharedModule {}
