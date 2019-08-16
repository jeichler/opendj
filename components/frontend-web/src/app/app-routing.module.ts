import { AuthGuard } from './providers/auth.guard';
import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', redirectTo: 'app-login', pathMatch: 'full' },
  { path: 'app-login', loadChildren: './pages/login/login.module#LoginPageModule', runGuardsAndResolvers: 'always' },
  { path: 'app-curator-login', loadChildren: './pages/curator-login/curator-login.module#CuratorLoginPageModule', runGuardsAndResolvers: 'always' },
  // { path: 'home', loadChildren: './pages/home/home.module#HomePageModule' },
  { path: 'app-playlist', loadChildren: './pages/playlist/playlist.module#PlaylistPageModule', runGuardsAndResolvers: 'always' , canActivate: [AuthGuard]},
  { path: 'app-create-event', loadChildren: './pages/create-event/create-event.module#CreateEventPageModule', runGuardsAndResolvers: 'always', canActivate: [AuthGuard]},
  { path: ':userEvent', loadChildren: './pages/event/event.module#EventPageModule', runGuardsAndResolvers: 'always' }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules, onSameUrlNavigation: 'reload' })
  ],
  providers: [],
  exports: [RouterModule]

})
export class AppRoutingModule { }
