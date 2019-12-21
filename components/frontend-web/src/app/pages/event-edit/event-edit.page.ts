import { Component, OnInit, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Events, ToastController, IonContent, AlertController } from '@ionic/angular';
import { UserDataService } from '../../providers/user-data.service';
import { FormBuilder, FormGroup, Validators, FormControl, ValidatorFn, AbstractControl } from '@angular/forms';
import { MusicEvent } from 'src/app/models/music-event';
import { FEService } from 'src/app/providers/fes.service';
import { UserSessionState } from 'src/app/models/usersessionstate';

@Component({
  selector: 'app-event-edit',
  templateUrl: './event-edit.page.html',
  styleUrls: ['./event-edit.page.scss'],
})
export class EventEditPage implements OnInit {

  @ViewChild(IonContent) content: IonContent;
  eventForm: FormGroup;
  event = new MusicEvent();
  userState: UserSessionState;
  submitAttempt: boolean;
  showHelp = true;
  tooltipOptions = {
    placement: 'left',
    hideDelayTouchscreen: 2500,
    hideDelayAfterClick: 2500,
    trigger: 'click',
    'max-width': 300,
    'show-delay': 0
  };

  constructor(
    public router: Router,
    private events: Events,
    public userDataService: UserDataService,
    public feService: FEService,
    public formBuilder: FormBuilder,
    public toastController: ToastController,
    public alertController: AlertController,
  ) { }

  private async presentToast(data) {
    const toast = await this.toastController.create({
      message: data,
      position: 'top',
      color: 'light',
      duration: 2000
    });
    toast.present();
  }

  private mapEventToForm(f: FormGroup, e: MusicEvent) {
    console.debug('begin mapEventToForm');
    f.patchValue(e);

    // ID is only editable upon create:
    if (this.event && this.event.eventID) {
      f.get('eventID').disable();
    } else {
      f.get('eventID').enable();
    }
  }

  public async toggleHelp() {
    if (this.showHelp) {
      this.showHelp = false;
    } else {
      this.showHelp = true;
    }
  }

  public async create({ value, valid }: { value: any, valid: boolean }) {
    console.debug('create');
    console.debug(value);

    if (valid) {
      Object.assign(this.event, value);

      await this.feService.createEvent(this.event).subscribe((event) => {
        console.debug('createEvent -> SUCCESS');
        this.event = event;
        this.mapEventToForm(this.eventForm, this.event);

        this.userState = new UserSessionState();
        this.userState.username = event.owner;
        this.userState.currentEventID = this.event.eventID;
        this.userState.isEventOwner = true;
        this.userState.isCurator = true;
        this.userState.isLoggedIn = true;
        this.events.publish('sessionState:modified', this.userState);
        this.presentToast('You have successfully created this event. You have been also logged in as owner to this event.');
        this.content.scrollToTop();
      },
        (err) => {
          console.error('Calling server side create event...FAILED', err);
          this.presentToast('ERROR creating this event');
        });
    } else {
      console.debug('Form is not valid, ignoring create request');
      this.presentToast('Form is not valid! Please submit all required data.');
    }
  }

  public async update({ value, valid }: { value: any, valid: boolean }) {
    console.debug('update');
    if (valid) {
      Object.assign(this.event, value);

      await this.feService.updateEvent(this.event).subscribe((event) => {
        console.debug('updateEvent -> SUCCESS');
        this.event = event;
        this.mapEventToForm(this.eventForm, this.event);
        this.presentToast('You have successfully updated this event.');
        this.content.scrollToTop();
      },
        (err) => {
          console.error('Calling server side update event...FAILED', err);
          this.presentToast('ERROR updating this event');
        });
    } else {
      console.debug('Form is not valid, ignoring update request');
      this.presentToast('Form is not valid! Please submit all required data.');
    }
  }

  public async deleteAlertConfirm() {
    const alert = await this.alertController.create({
      header: 'Delete Event!',
      message: 'Are you sure you want to <strong>delete</strong> this event?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary seleniumCancel',
          handler: (data) => {

          }
        }, {
          text: 'Okay',
          cssClass: 'seleniumOkay',
          handler: () => {
            this.deleteEvent();
          }
        }
      ]
    });
    await alert.present();
  }

  private async deleteEvent() {
    console.debug('deleteEvent');
    await this.feService.deleteEvent(this.event.eventID).subscribe(async (event) => {
      console.debug('deleteEvent -> SUCCESS');
      this.presentToast('You have successfully DELETED this event.');
      this.userState = new UserSessionState();
      this.events.publish('sessionState:modified', this.userState);
      this.event = await this.feService.readEvent(null).toPromise();
      this.mapEventToForm(this.eventForm, this.event);
      this.content.scrollToTop();
    },
      (err) => {
        this.presentToast('ERROR: Event could not be deleted');
        console.error('Calling server side delete event...FAILED', err);
      });
  }

  public async refreshState() {
    console.debug('refreshState');
    try {
      this.userState = await this.userDataService.getUser();
      // if the user is logged in as user or curator, he should not have access to this page -> redirect to playlist
      if (this.userState.isLoggedIn && !this.userState.isEventOwner) {
        this.router.navigateByUrl('ui/playlist-user');
        return;
      }
      // if user is not logged in -> load new default event.
      if (!this.userState.isLoggedIn) {
        this.event = await this.feService.readEvent(null).toPromise();

        // Highlight mandatory fields by triggering form validation:
        this.eventForm.get('eventID').markAsTouched();
        this.eventForm.get('name').markAsTouched();
        this.eventForm.get('owner').markAsTouched();
      }

      // if the user is the owner, load the event data
      if (this.userState.isLoggedIn && this.userState.isEventOwner) {
        this.event = await this.feService.readEvent(this.userState.currentEventID).toPromise();
      }
      this.ensureTrackFeedbackEmojis();
      this.mapEventToForm(this.eventForm, this.event);
    } catch (err) {
      console.error('refreshState failed', err);
      this.router.navigateByUrl('ui/landing');
    }
}

  async ionViewDidEnter() {
    console.debug('ionViewDidEnter');
    await this.refreshState();

  }

  async ngOnInit() {
    console.debug('ngOnInit');
    this.eventForm = this.formBuilder.group({
      // TODO: add this async validator ->  EventIdValidator
      eventID: [{value: '', disabled: false}, Validators.compose([Validators.minLength(3), Validators.maxLength(12), Validators.pattern('[a-zA-Z0-9]*'), Validators.required]), null],
      name: ['', Validators.compose([Validators.minLength(3), Validators.required])],
      url: [{value: '', disabled: true}],
      maxUsers: [0, Validators.min(1)],
      owner: ['', Validators.compose([Validators.required, Validators.maxLength(20)])],
      passwordOwner: ['', Validators.compose([Validators.minLength(3), Validators.required])],
      // ToDo: Only Required if everybodyIsCurator is false
      passwordCurator: ['', Validators.compose([Validators.minLength(3), Validators.required])],
      passwordUser: [''],
      maxDurationInMinutes: [0, Validators.min(10)],
      maxTracksInPlaylist: [0, Validators.min(2)],
      eventStartsAt: [new Date().toISOString(), Validators.required],
      eventEndsAt: [{value: '', disabled: true}, Validators.nullValidator],
      allowDuplicateTracks: [false],
      progressPercentageRequiredForEffectivePlaylist: [false],
      beginPlaybackAtEventStart: [false],
      everybodyIsCurator: [false],
      pauseOnPlayError: [false],
      emojiTrackLike: ['🥰', Validators.compose([Validators.minLength(1), Validators.maxLength(2), Validators.required])],
      enableTrackLiking: [false],
      emojiTrackHate: ['🤮', Validators.compose([Validators.minLength(1), Validators.maxLength(2), Validators.required])],
      enableTrackHating: [false],
      enableTrackAI: [false],
      demoAutoskip: [''],
      demoNoActualPlaying: [false],
      demoAutoFillEmptyPlaylist: [false]
    });
  }

  ensureTrackFeedbackEmojis() {
    if (!this.event.emojiTrackLike) {
      this.event.emojiTrackLike = '🥰';
    }
    if (!this.event.emojiTrackHate) {
      this.event.emojiTrackHate = '🤮';
    }
  }


}
