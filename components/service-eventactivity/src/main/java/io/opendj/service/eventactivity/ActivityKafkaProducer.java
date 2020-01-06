package io.opendj.service.eventactivity;

import java.util.logging.Logger;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import javax.enterprise.context.ApplicationScoped;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.eclipse.microprofile.reactive.messaging.Outgoing;
import org.reactivestreams.Publisher;

import io.reactivex.BackpressureStrategy;
import io.reactivex.Flowable;
import io.reactivex.FlowableEmitter;
import io.smallrye.reactive.messaging.kafka.KafkaMessage;

@ApplicationScoped
public class ActivityKafkaProducer {
    private static Logger log = Logger.getLogger(ActivityKafkaProducer.class.getName());

    /*
     * @Outgoing("event-activity") public Object produce() {
     * log.entering("ActivityProducer", "produce");
     * 
     * EventActivity activity = new EventActivity(); KafkaMessage<String, String>
     * msg = KafkaMessage.of("key-0", "value-0"); log.exiting("ActivityProducer",
     * "produce"); return msg; }
     */

    // Boy, this is ugly and complicated. Why? See here:
    // https://stackoverflow.com/questions/58340609/is-there-any-function-in-quarkus-to-send-message-to-kafka
    private FlowableEmitter<KafkaMessage<String, String>> emitter;
    private Flowable<KafkaMessage<String, String>> outgoingStream;

    public void produce(EventActivity activity) throws Exception {
        log.entering("ActivityKafkaProducer", "produce");

        final ObjectMapper mapper = new ObjectMapper();
        final String json = mapper.writeValueAsString(activity);
      
        KafkaMessage<String, String> m = KafkaMessage.of(activity.eventID, json);
        emitter.onNext(m);

        log.exiting("ActivityKafkaProducer", "produce");
    }

    @PostConstruct
    void init() {
        outgoingStream = Flowable.create(emitter -> this.emitter = emitter, BackpressureStrategy.BUFFER);
    }

    @PreDestroy
    void dispose() {
        emitter.onComplete();
    }

    @Outgoing("event-activity")
    Publisher<KafkaMessage<String, String>> produceKafkaMessage() {
        return outgoingStream;
    }

}