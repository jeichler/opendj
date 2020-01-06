package io.opendj.service.eventactivity;

import java.time.Instant;
import java.util.logging.Level;
import java.util.logging.Logger;

import javax.inject.Inject;
import javax.ws.rs.Consumes;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.jboss.resteasy.annotations.jaxrs.PathParam;

@Path("/api/service-eventactivity/v1")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class EventActivityResource {

    private static Logger logger = Logger.getLogger(EventActivityResource.class.getName());

    @Inject
    ActivityKafkaProducer msgProducer;

    @POST
    @Path("/events/{eventID}/activity")
    public String postEventActivity(final EventActivity newEventActivity, @PathParam final String eventID) {

        logger.entering("EventActivityResource", "postEventActivity");
        String result = "OK";
        try {

            if (newEventActivity.eventID == null || newEventActivity.eventID.length() == 0) {
                newEventActivity.eventID = eventID;
            }

            if (newEventActivity.timestamp == null || newEventActivity.timestamp.length() == 0) {
                newEventActivity.timestamp = Instant.now().toString();
            }

            if (!newEventActivity.eventID.equals(eventID)) {
                logger.log(Level.WARNING, () -> "EventID from PathParm >" + newEventActivity.eventID
                        + "< does not match eventID from JSON >" + eventID + "<");
            }

            msgProducer.produce(newEventActivity);
        } catch (Exception err) {
            String json = "?";
            try {
                json = new ObjectMapper().writeValueAsString(newEventActivity);
            } catch (JsonProcessingException e) {
                logger.log(Level.INFO, "Ignored", e);
            }

            logger.log(Level.WARNING, "postEventActivity failed for JSON=" + json, err);
            result = "ERR";

        }


        logger.exiting("EventActivityResource", "postEventActivity");
        return result;
    }
}