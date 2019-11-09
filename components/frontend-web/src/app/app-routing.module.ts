import { AuthGuard } from './providers/auth.guard';
import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [

  { path: '', redirectTo: 'ui/landing', pathMatch: 'full' },
  { path: 'ui/landing', loadChildren: './pages/landing/landing.module#LandingPageModule', runGuardsAndResolvers: 'always' },
  { path: 'ui/event/:eventId', loadChildren: './pages/event/event.module#EventPageModule', runGuardsAndResolvers: 'always'},
  { path: 'ui/create-event', loadChildren: './pages/create-event/create-event.module#CreateEventPageModule', runGuardsAndResolvers: 'always' },
  { path: 'ui/playlist-user', loadChildren: './pages/playlist/playlist.module#PlaylistPageModule', runGuardsAndResolvers: 'always' , canActivate: [AuthGuard]},
  { path: 'ui/playlist-curator', loadChildren: './pages/playlist/playlist.module#PlaylistPageModule', runGuardsAndResolvers: 'always' , canActivate: [AuthGuard]},
  { path: 'ui/playlist-event', loadChildren: './pages/playlist/playlist.module#PlaylistPageModule', runGuardsAndResolvers: 'always' , canActivate: [AuthGuard]},
  { path: 'ui/legal', loadChildren: './pages/legal/legal.module#LegalPageModule', runGuardsAndResolvers: 'always' },
  { path: ':eventID', redirectTo: 'ui/event/:eventID', pathMatch: 'full' },
  { path: '**', redirectTo: 'ui/landing' },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules, onSameUrlNavigation: 'reload' })
  ],
  providers: [],
  exports: [RouterModule]

})
export class AppRoutingModule { }
