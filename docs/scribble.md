
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
http://www.opendj.io/backend-spotifyprovider/auth_callback
http://spotify-provider-boundary-dfroehli-opendj-dev.apps.ocp1.stormshift.coe.muc.redhat.com/backend-spotifyprovider/auth_callback
http://localhost:8081/backend-spotifyprovider/auth_callback

# provider api:

# first: get login url:
http://localhost:8080/api/provider-spotify/v1/getSpotifyLoginURL?event=0
http://dev.opendj.io/api/provider-spotify/v1/getSpotifyLoginURL?event=0

# second: (copy paste that URL to another tab and see spotify consent screen, then call back
# Success full if you see a "1" response


# third: Searches, currentTrack, AvailDevices:
http://localhost:8080/api/provider-spotify/v1/searchTrack?event=4711&q=Michael+Jackson
http://localhost:8080/api/provider-spotify/v1/getCurrentTrack?event=4711
http://localhost:8080/api/provider-spotify/v1/getAvailableDevices?event=4711

http://dev.opendj.io/api/provider-spotify/v1/searchTrack?event=0&q=Rock
http://dev.opendj.io/api/provider-spotify/v1/getCurrentTrack?event=0
http://dev.opendj.io/api/provider-spotify/v1/getAvailableDevices?event=0


# Access Playlist
http://localhost:8081/api/service-playlist/v1/events/0/
http://dev.opendj.io/api/service-playlist/v1/events/0/
http://dev.opendj.io/api/service-playlist/v1/events/0/playlists/0/play
http://dev.opendj.io/api/service-playlist/v1/events/0/playlists/0/pause
http://dev.opendj.io/api/service-playlist/v1/events/0/playlists/0/next

# Add TracK

curl -d '{"provider":"spotify", "id":"3QTTAj8piyRBfhoPEfJC6y", "user": "HappyDan"}' -H "Content-Type: application/json" -X POST http://localhost:8081/api/service-playlist/v1/events/0/playlists/0/tracks







# playlist API RESTfull:
http://localhost:8081/api/service-playlist/v1/events/4711/playlists/42/tracks



## Retrieve current Playlist:
GET dev.opendj.io/api/service-playlist/v1/playlists/{eventId}/{playlistId}/tracks
Response: Array of Track Objects:
[{
  "id": "4pbJqGIASGPr0ZpGpnWkDn",
  "name": "We Will Rock You - Remastered",
  "artist": "Queen",
  "year": 1977,
  "image_url": "https://i.scdn.co/image/3b745272b2865b71822c5c6c2727ccdcade6aa9f",
  "duration_ms": 122066,
  "preview": "https://p.scdn.co/mp3-preview/1d423eaa321c18b53fa2b857bcb60b8aa92cca04?cid=ae5f9971dec243f98cf746c496181712",
  "popularity": 79,
  "provider": "spotify",
  "genre": "glam rock, rock",
  "danceability": 69,
  "energy": 50,
  "acousticness": 68,
  "instrumentalness": 0,
  "liveness": 26,
  "happiness": 48,
  "bpm": 81,
  "added_by": "dfroehli"
}]

## start, stop,skip current Playlist (Curators Only)
POST dev.opendj.io/api/service-playlist/v1/playlists/{eventId}/{playlistId}/play

## Add Track to to List:
POST dev.opendj.io/api/service-playlist/v1/playlists/{eventId}/{playlistId}/tracks
Input:(Body: provider, id as received from search, userID)
Response: 200 OK

## Move Track to new Position:
PATCH dev.opendj.io/api/service-playlist/v1/playlists/{eventId}/{playlistId}/tracks/{trackId}
Input Body: newPos, zero based integer of new desired position in the playlist of that track
Response: 200 OK


# playlist API Old School::

## Retrieve current Playlist:
GET dev.opendj.io/api/service-playlist/v1/read?event={eventId}&playlist={playlistId}
Response: Array of Track Objects:
[{
  "id": "4pbJqGIASGPr0ZpGpnWkDn",
  "name": "We Will Rock You - Remastered",
  "artist": "Queen",
  "year": 1977,
  "image_url": "https://i.scdn.co/image/3b745272b2865b71822c5c6c2727ccdcade6aa9f",
  "duration_ms": 122066,
  "preview": "https://p.scdn.co/mp3-preview/1d423eaa321c18b53fa2b857bcb60b8aa92cca04?cid=ae5f9971dec243f98cf746c496181712",
  "popularity": 79,
  "provider": "spotify",
  "genre": "glam rock, rock",
  "danceability": 69,
  "energy": 50,
  "acousticness": 68,
  "instrumentalness": 0,
  "liveness": 26,
  "happiness": 48,
  "bpm": 81,
  "added_by": "dfroehli"
}]

## start, stop,skip current Playlist (Curators Only)
POST dev.opendj.io/api/service-playlist/v1/play?event={eventId}&playlist={playlistId}&cmd=play
Other cmds: stop, skip

## Add Track to to List:
POST dev.opendj.io/api/service-playlist/v1/addTrack?event={eventId}&playlist={playlistId}
Input:(Body: provider, id as received from search, userID)
Response: 200 OK

## Move Track to new Position:
POST dev.opendj.io/api/service-playlist/v1/moveTrack?event={eventId}&playlist={playlistId}
Input Body: provider,id as received from search, newPo (zero based integer of new desired position in the playlist of that track)
Response: 200 OK


# Ortwin says:
GET /events/0/playlists/0/
PUT /events/0/playlists/0/play'

