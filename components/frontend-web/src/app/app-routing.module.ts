import { AuthGuard } from './providers/auth.guard';
import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [

  { path: '', redirectTo: '_/landing', pathMatch: 'full' },
  { path: '_/landing', loadChildren: './pages/landing/landing.module#LandingPageModule' },
  { path: '_/event-create', loadChildren: './pages/event/event.module#EventPageModule', runGuardsAndResolvers: 'always', canActivate: [AuthGuard]},
  { path: '_/login', loadChildren: './pages/login/login.module#LoginPageModule' },
//  { path: ':userEventID', loadChildren: './pages/login-event/login-event.module#LoginEventPageModule' },
  { path: ':userEventID', loadChildren: './pages/login/login.module#LoginPageModule' },
  { path: ':userEventID/playlist-user', loadChildren: './pages/playlist/playlist.module#PlaylistPageModule', runGuardsAndResolvers: 'always' , canActivate: [AuthGuard]},
  { path: ':userEventID/playlist-curator', loadChildren: './pages/playlist/playlist.module#PlaylistPageModule', runGuardsAndResolvers: 'always' , canActivate: [AuthGuard]},
  { path: ':userEventID/playlist-event', loadChildren: './pages/playlist/playlist.module#PlaylistPageModule', runGuardsAndResolvers: 'always' , canActivate: [AuthGuard]},
  { path: ':userEventID/event-crud', loadChildren: './pages/event/event.module#EventPageModule', runGuardsAndResolvers: 'always', canActivate: [AuthGuard]},
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
