import { AuthGuard } from './providers/auth.guard';
import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [

  { path: '', redirectTo: 'ui/landing', pathMatch: 'full' },
  { path: 'ui/landing', loadChildren: './pages/landing/landing.module#LandingPageModule' },
  { path: 'ui/event', loadChildren: './pages/event/event.module#EventPageModule', runGuardsAndResolvers: 'always', canActivate: [AuthGuard]},
  { path: 'ui/login', loadChildren: './pages/login/login.module#LoginPageModule' },
  { path: 'ui/playlist-user', loadChildren: './pages/playlist/playlist.module#PlaylistPageModule', runGuardsAndResolvers: 'always' , canActivate: [AuthGuard]},
  { path: 'ui/playlist-curator', loadChildren: './pages/playlist/playlist.module#PlaylistPageModule', runGuardsAndResolvers: 'always' , canActivate: [AuthGuard]},
  { path: 'ui/playlist-event', loadChildren: './pages/playlist/playlist.module#PlaylistPageModule', runGuardsAndResolvers: 'always' , canActivate: [AuthGuard]},
  { path: ':userEventID', loadChildren: './pages/login/login.module#LoginPageModule' },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules, onSameUrlNavigation: 'reload' })
  ],
  providers: [],
  exports: [RouterModule]

})
export class AppRoutingModule { }
