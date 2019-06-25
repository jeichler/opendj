oc start-build provider-spotify
oc start-build service-playlist
oc start-build service-web

# Workaround on pull:latest issue (timeout) - remove the tag:
oc tag frontend-web:latest --delete
oc start-build frontend-web

