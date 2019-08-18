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

        let url: string = state.url;
        console.debug('AuthGuard#canActivate called: state.url=%s', url);
        return this.checkLoginStatus(url);
    }

    checkLoginStatus(url: string): any {
        console.debug("begin checkLoginStatus url=%s", url);
        
        return this.userDataService.isLoggedIn().then(loggedIn => {
            let result = false;
            if (loggedIn === null) {
                console.debug("checkLoginStatus: user is not logged in");
                this.router.navigateByUrl('/app-login');
                result = false;
            } else {
                console.debug("checkLoginStatus: user is logged in");
                if (url === '/app-login' || url === '/app-curator-login') {
                    this.router.navigateByUrl('/app-playlist');
                }
                result= true;
            }
            console.debug("end checkLoginStatus url=%s result=%s", url, result);
            return result;
        });
 
    }
}
