export class UserSessionState {
    username = '';
    isLoggedIn = false;
    isEventOwner = false;
    isCurator = false;
    currentEventID = '';
    trackFeedback: Map<string, string> = new Map();

}
