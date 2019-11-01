
# Container Registry
Use Quay as registry to transport components between environments

## Install kafka on mac:
```bash
# Install:
brew install kafka

# Make sure jdk 1.8 is selected:
jenv local openjdk64-1.8.0.212


# Run single broker :
zookeeper-server-start /usr/local/etc/kafka/zookeeper.properties &
kafka-server-start /usr/local/etc/kafka/server.properties

# Run dual broker :
zookeeper-server-start /usr/local/etc/kafka/zookeeper.properties &
kafka-server-start /usr/local/etc/kafka/server0.properties
kafka-server-start /usr/local/etc/kafka/server1.properties


# Delete topics:
kafka-topics --bootstrap-server localhost:9092 --delete --topic opendj.state.provider-spotify
kafka-topics --bootstrap-server localhost:9092 --delete --topic opendj.data.playlist


# Create topics for dual brokers:
kafka-topics --bootstrap-server localhost:9092  --create --topic  opendj.state.provider-spotify --partitions 3 --replication-factor 2 --config retention.ms=43200000
kafka-topics --bootstrap-server localhost:9092  --create --topic opendj.data.event --partitions 3 --replication-factor 2 --config retention.ms=43200000
kafka-topics --bootstrap-server localhost:9092  --create --topic opendj.event.playlist --partitions 3 --replication-factor 2 --config retention.ms=43200000

# Delete Topics:
kafka-topics --bootstrap-server localhost:9092 --delete --topic opendj.state.provider-spotify 
kafka-topics --bootstrap-server localhost:9092 --delete --topic opendj.data.event
kafka-topics --bootstrap-server localhost:9092 --delete --topic opendj.event.playlist





```

oc rsh backend-eventstore-zookeeper-0 /opt/kafka/bin/kafka-topics.sh --zookeeper localhost:21810 --delete --topic opendj.data.playlist

oc rsh backend-eventstore-zookeeper-0 /opt/kafka/bin/kafka-topics.sh --zookeeper localhost:21810 --create --topic opendj.data.playlist --partitions 1 --replication-factor 1 --config retention.ms=43200000




# Get Logs from latest deployment:
oc logs -f dc/spotify-provider-boundary

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


# old:

http://localhost:8080/api/provider-spotify/v1/getSpotifyLoginURL?event=0
http://demo.opendj.io/api/provider-spotify/v1/getSpotifyLoginURL?event=0

http://demo.opendj.io/api/service-playlist/v1/events/0/


# provider api:
http://localhost:8080/api/provider-spotify/v1/events/0/providers/spotify/login



http://localhost:8080/api/provider-spotify/v1/events/0/providers/spotify/login
http://localhost:8080/api/provider-spotify/v1/events/0/providers/spotify/currentTrack
http://localhost:8080/api/provider-spotify/v1/events/0/providers/spotify/devices
http://localhost:8080/api/provider-spotify/v1/events/0/providers/spotify/search?q=Michael+Jackson
http://localhost:8080/api/provider-spotify/v1/events/0/providers/spotify/tracks/5ftamIDoDRpEvlZinDuNNW
http://localhost:8080/api/provider-spotify/v1/events/0/providers/spotify/pause/
http://localhost:8080/api/provider-spotify/v1/events/0/providers/spotify/play/5ftamIDoDRpEvlZinDuNNW
http://localhost:8080/api/provider-spotify/v1/events/0/providers/spotify/play/5ftamIDoDRpEvlZinDuNNW&pos=5000


http://localhost:8080/api/provider-spotify/v1/events/dan/providers/spotify/login
http://localhost:8080/api/provider-spotify/v1/events/dan/providers/spotify/devices
http://localhost:8080/api/provider-spotify/v1/events/dan/providers/spotify/play/5ftamIDoDRpEvlZinDuNNW

http://demo.opendj.io/api/provider-spotify/v1/events/dan/providers/spotify/login


http://dev.opendj.io/api/provider-spotify/v1/events/0/providers/spotify/login

http://dev.opendj.io/api/provider-spotify/v1/events/dan/providers/spotify/login
http://dev.opendj.io/api/provider-spotify/v1/events/dan/providers/spotify/tracks/5ftamIDoDRpEvlZinDuNNW





# Access Playlist
http://localhost:8081/api/service-playlist/v1/events/0/
http://localhost:8081/api/service-playlist/v1/events/0/playlists/0


http://dev.opendj.io/api/service-playlist/v1/events/demo/playlists/0

http://dev.opendj.io/api/service-playlist/v1/events/0/playlists/0/play
http://dev.opendj.io/api/service-playlist/v1/events/0/playlists/0/pause
http://dev.opendj.io/api/service-playlist/v1/events/0/playlists/0/next
http://dev.opendj.io/api/service-playlist/v1/events/0/playlists/0/push

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
oc adm prune images --keep-tag-revisions=3 --keep-younger-than=60m --confirm --registry-url https://docker-registry-default.apps.ocp1.stormshift.coe.muc.redhat.com/  --force-insecure=true

# ETCD Health Check
[root@ocp1master2 ~]# etcdctl3 --endpoints="https://172.16.10.11:2379,https://172.16.10.12:2379,https://172.16.10.13:2379" endpoint health

https://docs.openshift.com/container-platform/3.11/day_two_guide/docker_tasks.html




# IONIC
sudo npm install -g ionic --save
ionic info
ionic generate page pages/event
ionic serve


