
# Scribble
This contains 
- unsorted thoughts, ideas which have not yet been sorted into a the right document structure
- random notices


## Architecture Questions:


### Service Discovery: 
Description: 
How does a frontend service find out which backend services exist and which endpoints they have?  

Example: How does the EventService find out, which musicproviders are avail?
Could be backend-spotify, backend-soundclound, backend-itunes, or non of these.

Ideas:
- Option **A**: Env Variables
- Option **B**: some service discovery framework
- Option **C**: query k8s for existing routes/services
- Option **D**: Kafka-Topic  
    Have a topic where each service provider publishes an event with his name, endpoint urls (internal as xxx.svc.local and external via ocp router), versions etc..  
    The event is published every time a pod is started or every 12 hours. Thus consumers can read the topic -12 hours and know who might be there. To get final confidence, consumer can call the /health endpoint to verify - *et voilá*.  
- Option **E**: Use only async event communications, then the only service needed would be the event bus endpoint, which could be in an env variable.


### Service Versioning
How do we handle service versioning.
Idea:
- use ..../v1  in path (like k8s does) until there is a breaking change. then increase to v2
- avoid breaking changes like hell - no mandatory fields in any api or event!


- Principal: No breaking changes
- Principal: no mandatory fields in messages.



git structure: 
-docs
--meta
--project management
--requirements
--architecture
--design
--implementation
--deployment
--operation

-components
--<component name>
---docs
---api
---src
---deploy


# Container Registry
Use Quay as registry to transport components between environments

## Install kafka on mac:
```bash
# Install:
brew install kafka

# Make sure jdk 1.8 is selected:
jenv local openjdk64-1.8.0.212

# Get Logs from latest deployment:
oc logs -f dc/spotify-provider-boundary

# Run:
zookeeper-server-start /usr/local/etc/kafka/zookeeper.properties &
kafka-server-start /usr/local/etc/kafka/server.properties

# Delete topic:
kafka-topics --bootstrap-server localhost:9092 --delete --topic opendj-spotifyprovider-internal
```

# GIT
## Reference issues in other repo:
sa-mw-dach/OpenDJ#53
sa-mw-dach/OpenDJ#64


# Spotify API
Registered Callbacks in Spotify Developer Dashboard for OpenDJ App:
http://dev.opendj.io/api/provider-spotify/v1/auth_callback
http://demo.opendj.io/api/provider-spotify/v1/auth_callback
http://www.opendj.io/api/provider-spotify/v1/auth_callback
http://localhost:8081/api/provider-spotify/v1/auth_callback

http://localhost:8081/backend-spotifyprovider/auth_callback

# provider api:

# first: get login url:
http://localhost:8080/api/provider-spotify/v1/getSpotifyLoginURL?event=0
http://dev.opendj.io/api/provider-spotify/v1/getSpotifyLoginURL?event=0

http://demo.opendj.io/api/provider-spotify/v1/getSpotifyLoginURL?event=0

# second: (copy paste that URL to another tab and see spotify consent screen, then call back
# Success full if you see a "1" response


# third: Searches, currentTrack, AvailDevices:
http://localhost:8080/api/provider-spotify/v1/searchTrack?event=0&q=Michael+Jackson
http://localhost:8080/api/provider-spotify/v1/getCurrentTrack?event=0
http://localhost:8080/api/provider-spotify/v1/trackDetails?event=0&track=5ftamIDoDRpEvlZinDuNNW
http://localhost:8080/api/provider-spotify/v1/getAvailableDevices?event=0


http://demo.opendj.io/api/provider-spotify/v1/searchTrack?event=0&q=Michael+Jackson


# PLay
http://localhost:8080/api/provider-spotify/v1/play?event=0&track=5ftamIDoDRpEvlZinDuNNW&pos=0

# Pause
http://localhost:8080/api/provider-spotify/v1/pause?event=0


http://localhost:8080/api/provider-spotify/v1/play?event=0&track=47&pos=2000


http://dev.opendj.io/api/provider-spotify/v1/searchTrack?event=0&q=Rock
http://dev.opendj.io/api/provider-spotify/v1/getCurrentTrack?event=0
http://dev.opendj.io/api/provider-spotify/v1/getAvailableDevices?event=0


http://demo.opendj.io/api/provider-spotify/v1/getAvailableDevices?event=0

# Access Playlist
http://localhost:8081/api/service-playlist/v1/events/0/
http://localhost:8081/api/service-playlist/v1/events/0/playlists/0


http://dev.opendj.io/api/service-playlist/v1/events/0/playlists/0
http://dev.opendj.io/api/service-playlist/v1/events/0/playlists/0/play
http://dev.opendj.io/api/service-playlist/v1/events/0/playlists/0/pause
http://dev.opendj.io/api/service-playlist/v1/events/0/playlists/0/next

http://demo.opendj.io/api/service-playlist/v1/events/0/playlists/0


# Add Track
curl -d '{"provider":"spotify", "id":"3QTTAj8piyRBfhoPEfJC6y", "user": "HappyDan"}' -H "Content-Type: application/json" -X POST http://localhost:8081/api/service-playlist/v1/events/0/playlists/0/tracks

curl -d '{"provider":"spotify", "id":"3QTTAj8piyRBfhoPEfJC6y", "user": "HappyDan"}' -H "Content-Type: application/json" -X POST http://dev.opendj.io/api/service-playlist/v1/events/0/playlists/0/tracks

# Move Track:
curl -d '{"provider":"spotify", "id":"3QTTAj8piyRBfhoPEfJC6y", "from": "IDontCare", "to": "0"}' -H "Content-Type: application/json" -X POST http://localhost:8081/api/service-playlist/v1/events/0/playlists/0/reorder

# Delete Track
curl -X DELETE http://localhost:8081/api/service-playlist/v1/events/0/playlists/0/tracks/spotify:XXX3QTTAj8piyRBfhoPEfJC6y

curl -X DELETE http://dev.opendj.io/api/service-playlist/v1/events/0/playlists/0/tracks/spotify:3QTTAj8piyRBfhoPEfJC6y


# Cleanup:
oc adm prune builds --confirm
oc adm prune deployments --confirm
oc adm prune images --keep-tag-revisions=3 --keep-younger-than=60m --confirm --registry-url https://docker-registry-default.apps.ocp1.stormshift.coe.muc.redhat.com/


