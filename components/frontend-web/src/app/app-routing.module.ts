import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', loadChildren: './pages/login/login.module#LoginPageModule', runGuardsAndResolvers: 'always' },
  // { path: 'home', loadChildren: './pages/home/home.module#HomePageModule' },
  { path: 'playlist', loadChildren: './pages/playlist/playlist.module#PlaylistPageModule', runGuardsAndResolvers: 'always' },
  { path: 'curator-login', loadChildren: './pages/curator-login/curator-login.module#CuratorLoginPageModule', runGuardsAndResolvers: 'always' },
  { path: 'event', loadChildren: './pages/event/event.module#EventPageModule' }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules, onSameUrlNavigation: 'reload' })
  ],
  providers: [],
  exports: [RouterModule]

})
export class AppRoutingModule { }
