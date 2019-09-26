#!/usr/bin/env bash



curl -X POST \
  -d "@sampleCall.json" \
  https://model-service-dfroehli-opendj-dev.apps.ocp1.stormshift.coe.muc.redhat.com/predict
