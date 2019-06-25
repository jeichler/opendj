import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { CuratorLoginPage } from './curator-login.page';
import { MoreOptionsComponent } from 'src/app/components/more-options/more-options.component';
import { SharedModule } from 'src/app/components/shared.module';

const routes: Routes = [
  {
    path: '',
    component: CuratorLoginPage
  }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SharedModule,
    RouterModule.forChild(routes)
  ],
  entryComponents: [
    MoreOptionsComponent
  ],
  declarations: [ CuratorLoginPage ]
})
export class CuratorLoginPageModule {}
