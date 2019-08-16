import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { UserDataService } from './user-data.service';

@Injectable({
    providedIn: 'root',
})
export class AuthGuard implements CanActivate {

    constructor(private userDataService: UserDataService, private router: Router) { }

    canActivate(
        next: ActivatedRouteSnapshot,
        state: RouterStateSnapshot): boolean {

        const url: string = state.url;
        console.log('AuthGuard#canActivate called: ' + url);
        return this.checkLoginStatus(url);
    }

    checkLoginStatus(url: string): any {
        return this.userDataService.isLoggedIn().then(loggedIn => {
            if (loggedIn === null) {
                this.router.navigateByUrl('/app-login');
                return false;
            } else {
                if (url === '/app-login' || url === '/app-curator-login') {
                    this.router.navigateByUrl('/app-playlist');
                }
                return true;
            }
        });

    }
}
