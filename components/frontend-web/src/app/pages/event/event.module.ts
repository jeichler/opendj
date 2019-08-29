import { LoginModalComponent } from './../../components/login-modal/login-modal.component';
import { NgModule } from '@angular/core';
import { SharedModule } from 'src/app/components/shared.module';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';

import { IonicModule } from '@ionic/angular';

import { EventPage} from './event.page';

const routes: Routes = [
  {
    path: '',
    component: EventPage
  }
];

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SharedModule,
    IonicModule,
    RouterModule.forChild(routes)
  ],
  declarations: [EventPage],
  entryComponents: [
    LoginModalComponent
  ]
})
export class EventPageModule {}
