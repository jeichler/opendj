#!/bin/bash

function startTest {
    echo "Start Test #$1-$2"
    mkdir -p tst$1-$2
    cd tst$1-$2
    selenium-side-runner ../loadTests.side -c "browserName=$2" --filter loadTests --base-url http://dev.opendj.io --server http://hub-dfroehli-selenium.apps.ocp1.stormshift.coe.muc.redhat.com/wd/hub >out.txt 2>&1 &
    sleep 1
    cd ..
}

for i in {1..10}
do
    startTest $i firefox
done

for i in {1..10}
do
    startTest $i chrome
done
