import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CuratorLoginPage } from './curator-login.page';

describe('CuratorLoginPage', () => {
  let component: CuratorLoginPage;
  let fixture: ComponentFixture<CuratorLoginPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CuratorLoginPage ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CuratorLoginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
