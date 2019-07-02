import { HttpClientModule } from '@angular/common/http';
import { NgModule, APP_INITIALIZER } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';
import { IonicStorageModule } from '@ionic/storage';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
// import { EnvServiceProvider } from './providers/env.service.provider';
import { MockService } from './providers/mock.service';
import { WebsocketService } from './providers/websocket.service';
import { ConfigService } from './providers/config.service';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    HttpClientModule,
    IonicModule.forRoot({animated: true}),
    IonicStorageModule.forRoot(),
    AppRoutingModule
  ],
  providers: [
    ConfigService,
    StatusBar,
    SplashScreen,
    // EnvServiceProvider,
    MockService,
    WebsocketService,
    {
      provide: APP_INITIALIZER,
      useFactory: (configService: ConfigService) =>
          () => configService.loadConfigurationData(),
      deps: [ConfigService],
      multi: true
    },
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
