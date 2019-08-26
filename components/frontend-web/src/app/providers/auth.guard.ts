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
        console.debug('AuthGuard#canActivate called: state.url=%s', url);
        return this.checkLoginStatus(url);
    }

    checkLoginStatus(url: string): any {
        console.debug('begin checkLoginStatus url=%s', url);
        const urlString = url;
        return this.userDataService.getUser().then(user => {
            console.debug(user);
            let result = false;
            if (!user.isLoggedIn) {
                console.debug('checkLoginStatus: user is not logged in');
                if (url.startsWith('/ui/')) {
                    this.router.navigateByUrl('ui/login', {state: {ctx: 'owner'}});
                } else {
                    this.router.navigateByUrl('ui/login', {state: {ctx: 'user', currentEventID: urlString.substring(1)}});
                }
                result = false;
            } else {
                console.debug('checkLoginStatus: user is logged in');
                result = true;
            }
            console.debug('end checkLoginStatus url=%s result=%s', url, result);
            return result;
        });

    }
}
