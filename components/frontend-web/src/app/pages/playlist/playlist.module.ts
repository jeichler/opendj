import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { PlaylistPage, PlaylistAddModalComponent } from './playlist.page';
import { CurrentTrackComponent } from 'src/app/components/current-track/current-track.component';
import { SharedModule } from 'src/app/components/shared.module';
import { LoginModalComponent } from 'src/app/components/login-modal/login-modal.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SharedModule,
    RouterModule.forChild([
      {
        path: '',
        component: PlaylistPage
      }
    ])
  ],
  declarations: [
    PlaylistPage,
    PlaylistAddModalComponent
  ],
  entryComponents: [
    PlaylistAddModalComponent,
    CurrentTrackComponent,
    LoginModalComponent
  ]
})
export class PlaylistPageModule { }
