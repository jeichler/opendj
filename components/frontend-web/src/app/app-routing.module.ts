import { AuthGuard } from './providers/auth.guard';
import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [

  { path: '', redirectTo: 'ui/landing', pathMatch: 'full' },
  { path: 'ui/landing', loadChildren: './pages/landing/landing.module#LandingPageModule' },
  { path: 'ui/login', loadChildren: './pages/login/login.module#LoginPageModule' },
  // { path: 'ui/event', loadChildren: './pages/event/event.module#EventPageModule'},
  { path: 'ui/event/:eventId', loadChildren: './pages/event/event.module#EventPageModule'},
  { path: 'ui/create-event', loadChildren: './pages/create-event/create-event.module#CreateEventPageModule' },
  { path: 'ui/playlist-user', loadChildren: './pages/playlist/playlist.module#PlaylistPageModule', runGuardsAndResolvers: 'always' , canActivate: [AuthGuard]},
  { path: 'ui/playlist-curator', loadChildren: './pages/playlist/playlist.module#PlaylistPageModule', runGuardsAndResolvers: 'always' , canActivate: [AuthGuard]},
  { path: 'ui/playlist-event', loadChildren: './pages/playlist/playlist.module#PlaylistPageModule', runGuardsAndResolvers: 'always' , canActivate: [AuthGuard]},
  // { path: ':userEventID', loadChildren: './pages/playlist/playlist.module#PlaylistPageModule', runGuardsAndResolvers: 'always' , canActivate: [AuthGuard] },
  { path: ':eventID', redirectTo: 'ui/event/:eventID', pathMatch: 'full' },
  { path: '**', redirectTo: 'ui/landing', pathMatch: 'full' }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules, onSameUrlNavigation: 'reload' })
  ],
  providers: [],
  exports: [RouterModule]

})
export class AppRoutingModule { }
