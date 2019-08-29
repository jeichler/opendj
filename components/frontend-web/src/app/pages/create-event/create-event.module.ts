import { NgModule } from '@angular/core';
import { SharedModule } from 'src/app/components/shared.module';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';

import { IonicModule } from '@ionic/angular';

import { CreateEventPage } from './create-event.page';
import { TooltipModule } from 'ng2-tooltip-directive';

const routes: Routes = [
  {
    path: '',
    component: CreateEventPage
  }
];

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SharedModule,
    IonicModule,
    TooltipModule,
    RouterModule.forChild(routes)
  ],
  declarations: [CreateEventPage]
})
export class CreateEventPageModule {}
