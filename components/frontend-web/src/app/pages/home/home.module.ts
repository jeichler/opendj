import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { HomePage } from './home.page';
import { ChartsModule } from 'ng2-charts-x';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    ChartsModule,
    RouterModule.forChild([
      {
        path: '',
        component: HomePage
      }
    ])
  ],
  declarations: [HomePage]
})
export class HomePageModule {}
