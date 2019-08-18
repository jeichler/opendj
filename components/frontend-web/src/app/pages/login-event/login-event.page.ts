import { Component, OnInit } from '@angular/core';
import { MusicEvent } from 'src/app/models/music-event';
import { FEService } from 'src/app/providers/fes.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UserDataService } from 'src/app/providers/user-data.service';
import { PopoverController, Events } from '@ionic/angular';
import { MoreOptionsComponent } from '../../components/more-options/more-options.component';

const listOfAnimals = ["Alligator","Anteater","Armadillo","Auroch","Axolotl","Badger","Bat","Bear","Beaver","Blobfish","Buffalo","Camel","Capybara","Chameleon","Cheetah","Chinchilla","Chipmunk","Chupacabra","Cormorant","Coyote","Crow","Dingo","Dinosaur","Dog","Dolphin","Duck","Dumbo Octopus","Elephant","Ferret","Fox","Frog","Giraffe","Goose","Gopher","Grizzly","Hamster","Hedgehog","Hippo","Hyena","Ibex","Ifrit","Iguana","Jackal","Jackalope","Kangaroo","Kiwi","Koala","Kraken","Lemur","Leopard","Liger","Lion","Llama","Loris","Manatee","Mink","Monkey","Moose","Narwhal","Nyan Cat","Orangutan","Otter","Panda","Penguin","Platypus","Pumpkin","Python","Quagga","Quokka","Rabbit","Raccoon","Rhino","Sheep","Shrew","Skunk","Squirrel","Tiger","Turtle","Unicorn","Walrus","Wolf","Wolverine","Wombat"];

@Component({
  selector: 'app-login-event',
  templateUrl: './login-event.page.html',
  styleUrls: ['./login-event.page.scss'],
})
export class LoginEventPage implements OnInit {
  currentEvent: MusicEvent = null;
  loginForm: FormGroup;
  eventID: string;
  submitAttempt: boolean;

  constructor(
    public feService: FEService,
    private route: ActivatedRoute,
    private events: Events,  
    public userDataService: UserDataService,
    public popOverCtrl: PopoverController,
    public formBuilder: FormBuilder,
    private router: Router,
  ) {
  }
  loginAction() {
    console.debug("begin loginAction");
    this.submitAttempt = true;
    if (this.loginForm.valid) {
      this.userDataService.login(this.loginForm.value.username, false).then(data => {
        //        this.events.publish('user:login', [this.loginForm.value.username, false]);
        console.debug("login okay - navigating to playlist");
        this.router.navigateByUrl('/'+this.currentEvent.eventID +'/playlist-user', { replaceUrl: true });      
      });
    } 
    console.debug("end loginAction");
  }

  async presentMoreOptions(ev: any) {
    const popover = await this.popOverCtrl.create({
      component: MoreOptionsComponent,
      event: ev,
      translucent: true
    });
    return await popover.present();
  }

  userNameGeneratorForZoe() {
    var animal = listOfAnimals[Math.floor(Math.random()*listOfAnimals.length)];
    var number = Math.floor(Math.random()*10)+1;
    return "Anon"+animal+number;
  }

  generateUsername() {
    this.loginForm.patchValue({
      username: this.userNameGeneratorForZoe()
    });
  }


  ngOnInit() {
    this.loginForm = this.formBuilder.group({
      username: ['', Validators.compose([Validators.minLength(3), Validators.required])]
    });

    this.eventID = this.route.snapshot.paramMap.get('userEventID');
    this.feService.readEvent(this.eventID).subscribe(
      (event) => {
        console.debug("readEvent returned %s", event);
        if (event) {
          this.currentEvent = event;
        } else {
          // Event does not exist.
          // TODO: Show error Message, then redirect to landing page
        }
      },
      err =>  console.error("readEvent failed with err=%s", err)
    );
  }

}
