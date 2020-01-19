const request = require('request');

const log4js = require('log4js');
const log = log4js.getLogger();
log.level = process.env.LOG_LEVEL || "trace";
const EVENTACTIVITY_PROVIDER_URL = process.env.EVENTACTIVITY_PROVIDER_URL || "http://localhost:8085/api/service-eventactivity/v1/";


function publishActivity(activity, eventID, data, display) {
    try {
        log.trace('begin publishActivity');

        if (!eventID) {
            throw Error("No EventID");
        }

        if (!activity) {
            activity = 'UNKNOWN';
        }

        if (!display) {
            display = 'Server internal activity';
        }

        let body = {
            "activity": activity,
            "eventID": eventID,
            "display": display,
            "timestamp": new Date().toISOString(),
            "data": data
        };

        request({
            method: 'POST',
            uri: EVENTACTIVITY_PROVIDER_URL + 'events/' + eventID + '/activity',
            body: body,
            json: true,
            timeout: 1000
        }, function(error, response, body) {
            if (error) {
                //                log.info('publishActivity failed - ignored', error, response, body);
                log.debug('publishActivity failed, this is ignored: ' + error);
            } else {
                log.trace('publishActivity response statusCode', response.statusCode)
            }
        });

        log.trace('end publishActivity');
    } catch (err) {
        log.debug('publishActivity failed, this is ignored: ' + err);
    }
}

module.exports.publishActivity = publishActivity;