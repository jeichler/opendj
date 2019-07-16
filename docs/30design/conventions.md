# Conventions

## Component names
Convention: ``` <layer>-<component>[-<additional>]```
- layer: the architecture layer, like frontend, service, provider, backend
- component: the actual name of the component
- additional: optional addition names, if a component is de-composed into multiple sub-comonents


## URI Paths and API Endpoints
**Important**: Single BASE DNS Name is expected, e.g. *dev.opendj.io*, *www.opendj.io*

- static UI stuff: /**ui**/*<component>*/...
  Examples: 
    - www.opendj.io/ui/web/img/logo.png
    The only exception to this rule is the landing page *www.opendj.io* which is served directly from there, at least with a re-direct to opendj.io/ui/web/index.html


- APIs: /**api**/\<component\>/\<version\>*
component: name of the component
version: major version number of the api. "v1" for most services for the time being.
  Examples:
    - www.opendj.io/api/playlist/v1/get 
    - www.opendj.io/api/provider-spotify/v1/search

## Kafka

1. There is one central broker infrastructure per deployment, to be used by all components of that deployment
1. Topics are created per deployment scripts and should not be created at runtime.  
Rational: Topics config like partitions, replicatioNFactor could depend on the type of the deployment (dev, prod)
1. If a message cant be consumed or produced to to technical errors, this is probably a major technical problem and allows the component to got into a NOT_READY state or fail totally


Topic conventioN::

**Important**: as we use dots (".") in topic names, we need to avoid underscores "_" as using both could create a problem with metrics.

```
opendj.<message type>.<data type> 
opendj: constant prefix
message type: 
1. 'data' for business data objects, updates of playlists, events etc.
1. 'state' internal component state objects
1. 'event' for events, e.g. user joined event, track stopped.
data type: name 
opendj.data.playlist

# Key: evendID:playListID
# Body: Playlist JSON
# Producers: service-playlist
# Consumers: service-bffweb
# Retention: 48h

opendj.state.provider-spotify
######## EVENTS #####

PLAYLIST:
track_play (key: eventID, value: provider:trackID)
track_pause (key: eventID, value: provider:trackID)

