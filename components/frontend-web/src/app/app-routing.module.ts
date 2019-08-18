import { AuthGuard } from './providers/auth.guard';
import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
//  { path: '', redirectTo: 'app-login', pathMatch: 'full' },
//  { path: 'app-login', loadChildren: './pages/login/login.module#LoginPageModule', runGuardsAndResolvers: 'always' },
//  { path: 'app-curator-login', loadChildren: './pages/curator-login/curator-login.module#CuratorLoginPageModule', runGuardsAndResolvers: 'always' },
//  { path: 'home', loadChildren: './pages/home/home.module#HomePageModule' },{ path: 'app-playlist', loadChildren: './pages/playlist/playlist.module#PlaylistPageModule', runGuardsAndResolvers: 'always' , canActivate: [AuthGuard]},
//  { path: 'app-create-event', loadChildren: './pages/create-event/create-event.module#CreateEventPageModule', runGuardsAndResolvers: 'always', canActivate: [AuthGuard]},
//  { path: ':userEvent', loadChildren: './pages/event/event.module#EventPageModule', runGuardsAndResolvers: 'always' },
//  { path: 'login-event', loadChildren: './pages/login-event/login-event.module#LoginEventPageModule' },

  { path: '', redirectTo: 'app-landing', pathMatch: 'full' },
  { path: 'app-landing', loadChildren: './pages/landing/landing.module#LandingPageModule' },
  { path: 'app-event-create', loadChildren: './pages/create-event/create-event.module#CreateEventPageModule', runGuardsAndResolvers: 'always', canActivate: [AuthGuard]},
  { path: ':userEventID', loadChildren: './pages/login-event/login-event.module#LoginEventPageModule' },
  { path: ':userEventID/playlist-user', loadChildren: './pages/playlist/playlist.module#PlaylistPageModule', runGuardsAndResolvers: 'always' , canActivate: [AuthGuard]},
  { path: ':userEventID/playlist-curator', loadChildren: './pages/playlist/playlist.module#PlaylistPageModule', runGuardsAndResolvers: 'always' , canActivate: [AuthGuard]},
  { path: ':userEventID/playlist-event', loadChildren: './pages/playlist/playlist.module#PlaylistPageModule', runGuardsAndResolvers: 'always' , canActivate: [AuthGuard]},
  { path: ':userEventID/event', loadChildren: './pages/create-event/create-event.module#CreateEventPageModule', runGuardsAndResolvers: 'always', canActivate: [AuthGuard]},
  { path: ':userEventID/login-curator', loadChildren: './pages/curator-login/curator-login.module#CuratorLoginPageModule', runGuardsAndResolvers: 'always' },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules, onSameUrlNavigation: 'reload' })
  ],
  providers: [],
  exports: [RouterModule]

})
export class AppRoutingModule { }
