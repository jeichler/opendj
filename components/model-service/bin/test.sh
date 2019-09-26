#!/bin/#!/usr/bin/env bash


curl -X POST \
  -d "@request1.json" \
  https://model-service-dfroehli-opendj-dev.apps.ocp1.stormshift.coe.muc.redhat.com/predict
