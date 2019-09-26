#!/bin/bash

export APP=model-service

oc login https://master.ocp1.stormshift.coe.muc.redhat.com:8443 --token=3wb_CWwtDKJBQ78dSTXSUOCDr691WqDpwlrw9NzmMbU

oc new-app -f deploy-template.yaml \
    -p APP_NAME=${APP} \
    -p GIT_URI=https://github.com/opendj/opendj.git \
    -p GIT_CONTEXT_DIR=components/model-service/src

oc start-build ${APP} --follow
