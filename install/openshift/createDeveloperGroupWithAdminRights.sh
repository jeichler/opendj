oc login https://master.ocp1.stormshift.coe.muc.redhat.com:8443  -u dfroehliadm
oc adm groups new opendj-developer
oc adm groups add-users opendj-developer dfroehli@redhat.com oschneid@redhat.com sbergste@redhat.com wrichter@redhat.com mpfuetzn@redhat.com iboernig@redhat.com 
