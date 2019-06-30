import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Events } from '@ionic/angular';
import { UserDataService } from '../../providers/user-data.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PopoverController } from '@ionic/angular';
import { MoreOptionsComponent } from '../../components/more-options/more-options.component';
const ung = require('username-generator');

const listOfAnimals = ["Alligator","Anteater","Armadillo","Auroch","Axolotl","Badger","Bat","Bear","Beaver","Blobfish","Buffalo","Camel","Capybara","Chameleon","Cheetah","Chinchilla","Chipmunk","Chupacabra","Cormorant","Coyote","Crow","Dingo","Dinosaur","Dog","Dolphin","Duck","Dumbo Octopus","Elephant","Ferret","Fox","Frog","Giraffe","Goose","Gopher","Grizzly","Hamster","Hedgehog","Hippo","Hyena","Ibex","Ifrit","Iguana","Jackal","Jackalope","Kangaroo","Kiwi","Koala","Kraken","Lemur","Leopard","Liger","Lion","Llama","Loris","Manatee","Mink","Monkey","Moose","Narwhal","Nyan Cat","Orangutan","Otter","Panda","Penguin","Platypus","Pumpkin","Python","Quagga","Quokka","Rabbit","Raccoon","Rhino","Sheep","Shrew","Skunk","Squirrel","Tiger","Turtle","Unicorn","Walrus","Wolf","Wolverine","Wombat"];

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {

  loginForm: FormGroup;
  submitAttempt: boolean;

  constructor(
    public router: Router,
    private events: Events,
    public userDataService: UserDataService,
    public popOverCtrl: PopoverController,
    public formBuilder: FormBuilder
  ) { }

   loginAction() {
    this.submitAttempt = true;
    if (!this.loginForm.valid) {
      return;
    } else {
      this.userDataService.login(this.loginForm.value.username, false).then(data => {
        this.events.publish('user:login', [this.loginForm.value.username, false]);
      });
    }
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
//      username: ung.generateUsername()
      username: this.userNameGeneratorForZoe()
    });
  }

  ngOnInit() {
    this.loginForm = this.formBuilder.group({
      username: ['', Validators.compose([Validators.minLength(3), Validators.required])]
    });
  }

}
