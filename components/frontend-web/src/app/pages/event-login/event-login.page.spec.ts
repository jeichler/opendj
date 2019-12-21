import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { EventLoginPage } from './event-login.page';

describe('EventLoginPage', () => {
  let component: EventLoginPage;
  let fixture: ComponentFixture<EventLoginPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ EventLoginPage ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(EventLoginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
