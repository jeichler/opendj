import { SharedModule } from 'src/app/components/shared.module';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';

import { IonicModule } from '@ionic/angular';

import { LoginPage } from './login.page';
import { MoreOptionsComponent } from 'src/app/components/more-options/more-options.component';

const routes: Routes = [
  {
    path: '',
    component: LoginPage
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
  declarations: [
    LoginPage
  ]
})
export class LoginPageModule {}
