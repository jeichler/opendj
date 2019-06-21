
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ChartDataSets, ChartOptions, Color, Label } from 'chart.js';


@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {

  public lineChartData: ChartDataSets[] = [
    { data: [65, 59, 80, 81, 56, 55, 40], label: 'Party Barometer' },
  ];
  public lineChartLabels: Label[] = ['19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'];
  public lineChartOptions: (ChartOptions & { annotation: any }) = {
    responsive: true,
  };
  public lineChartColors: Color[] = [
    {
      borderColor: 'black',
      backgroundColor: '#efefef',
    },
  ];
  public lineChartLegend = true;
  public lineChartType = 'line';

  constructor(
    public router: Router
  ) { }


  ngOnInit() {
  }

}
