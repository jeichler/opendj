var app = require('express')();
var http = require('http').createServer(app);
var cors = require('cors');
var io = require('socket.io')(http, { origins: '*:*', path: '/api/service-web/socket.io'} );
var kafka = require('kafka-node');
var port = process.env.PORT || 3000;
var kafkaURL = process.env.KAFKA_HOST || "localhost:9092";
var TOPIC_INTERNAL = process.env.topic || "opendj.data.playlist";

var log4js = require('log4js')
var log = log4js.getLogger();
log.level = "trace";

app.use(cors());

var currentPlaylist = {};

/**
 * Kafka Client Setup
 */

var kafkaClient = new kafka.KafkaClient({
    kafkaHost: kafkaURL,
    connectTimeout: 1000,
    requestTimeout: 500,
    autoConnect: true,
    connectRetryOptions: {
        retries: 10,
        factor: 1,
        minTimeout: 1000,
        maxTimeout: 1000,
        randomize: true,
    },
    idleConnection: 60000,
    reconnectOnIdle: true,
});
kafkaClient.on('error', function (err) {
    log.error("kafkaClient error: %s -  reconnecting....", err);
    kafkaClient.connect();
});
kafkaClient.on('connect', function (data) {
    log.info("kafkaClient connect: %s ", data);
});

function startKafkaConsumer() {

    var kafkaConsumer = new kafka.Consumer(kafkaClient, [
        { topic: TOPIC_INTERNAL } // offset, partition
    ], {
            autoCommit: true,
            fromOffset: true,
            offset: 0
        });

    kafkaConsumer.on('message', function (message) {
        log.info("kafkaConsumer received message: %s", JSON.stringify(message));

        try {

            var msg = JSON.parse(JSON.stringify(message));
            var msgPayload = JSON.parse(msg.value);
            currentPlaylist = msgPayload;
            io.emit('current-playlist', currentPlaylist);

        } catch (e) {
            log.error("kafkaConsumer Exception %s while processing message", e);
        }
    });

    kafkaConsumer.on('error', function (error) {
        log.error("kafkaConsumer error: %s", error);
    });
}

/**
* Socket.io connection handling
*/
function onConnection(socket) {

    log.info('socket.io user connected');
    socket.emit('current-playlist', currentPlaylist);

    socket.on('disconnect', function () {
        log.info('socket.io disconnected');
    });
}

io.on('connection', onConnection);

http.listen(port, function () {
    log.info('listening on *: '+port);
    startKafkaConsumer();
});
