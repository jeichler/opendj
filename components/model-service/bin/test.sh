#!/usr/bin/env bash



curl -v -X POST \
  -d '{"hello": "world"}'  \
  --header "Content-Type: application/json" \
  https://model-service-dfroehli-opendj-dev.apps.ocp1.stormshift.coe.muc.redhat.com/predict
