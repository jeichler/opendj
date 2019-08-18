import { SharedModule } from 'src/app/components/shared.module';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';

import { IonicModule } from '@ionic/angular';

import { LoginEventPage } from './login-event.page';
import { MoreOptionsComponent } from 'src/app/components/more-options/more-options.component';

const routes: Routes = [
  {
    path: '',
    component: LoginEventPage
  }
];

@NgModule({
  imports: [
    CommonModule,
    SharedModule,
    ReactiveFormsModule,
    IonicModule,
    RouterModule.forChild(routes)
  ],
  entryComponents: [
    MoreOptionsComponent
  ],
  declarations: [LoginEventPage]
})
export class LoginEventPageModule {}
