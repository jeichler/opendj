const log4js = require('log4js');
const log = log4js.getLogger();
log.level = process.env.LOG_LEVEL || "trace";


function publishActivity(activity, eventID, data, display) {
    try {
        log.trace('begin publishActivity');

        if (!display) {
            display = 'Server internal activity';
        }

        log.fatal('publishActivity\n   activity=%s\n   eventID=%s\n    data=%s\n    display=%s', activity, eventID, JSON.stringify(data), display);

        log.trace('end publishActivity');
    } catch (err) {
        log.warn('publishActivity failed, this is ignored', err);
    }
}

module.exports.publishActivity = publishActivity;