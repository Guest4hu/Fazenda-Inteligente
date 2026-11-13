package com.usjt.a3.config.mqtt;

import lombok.RequiredArgsConstructor;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.core.MessageProducer;
import org.springframework.integration.mqtt.core.DefaultMqttPahoClientFactory;
import org.springframework.integration.mqtt.core.MqttPahoClientFactory;
import org.springframework.integration.mqtt.inbound.MqttPahoMessageDrivenChannelAdapter;
import org.springframework.integration.mqtt.outbound.MqttPahoMessageHandler;
import org.springframework.integration.mqtt.support.DefaultPahoMessageConverter;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageHandler;

import java.util.Arrays;
import java.util.UUID;


/**
 * Spring Integration MQTT client configuration for inbound telemetry and outbound commands.
 *
 * <p>Uses separate TX and RX client identifiers derived from a per-instance random UUID suffix
 * to avoid broker session collisions across restarts or concurrent instances.</p>
 */
@Configuration
@EnableConfigurationProperties(MqttProperties.class)
@RequiredArgsConstructor
public class MqttConfig {

    private final MqttProperties properties;
    private final String sufix = UUID.randomUUID().toString().substring(0, 8);

    private String clientId(String papel) {
        return properties.clientIdPrefix() + "-" + papel + "-" + sufix;
    }

    /**
     * Configures the Paho MQTT client factory with clean sessions, automatic reconnect,
     * a 10s connection timeout, and a 60s keep-alive interval.
     *
     * @return shared {@link MqttPahoClientFactory} for inbound and outbound adapters
     */
    @Bean
    public MqttPahoClientFactory mqttPahoClientFactory(){
        MqttConnectOptions options = new MqttConnectOptions();
        options.setServerURIs(new String[]{properties.brokerUrl()});
        options.setCleanSession(true);
        options.setAutomaticReconnect(true);
        options.setConnectionTimeout(10);
        options.setKeepAliveInterval(60);

        DefaultMqttPahoClientFactory factory = new DefaultMqttPahoClientFactory();
        factory.setConnectionOptions(options);
        return factory;
    }

    /**
     * Creates the synchronous direct channel used by {@link MqttGateway} for outbound messages.
     *
     * @return outbound {@link MessageChannel}
     */
    @Bean
    public MessageChannel mqttOutboundChannel(){
        return new DirectChannel();
    }

    /**
     * Registers the outbound MQTT publisher defaulting to QoS 1 (at-least-once) and non-retained delivery.
     *
     * @return configured outbound {@link MessageHandler}
     */
    @Bean
    @ServiceActivator(inputChannel = "mqttOutboundChannel")
    public MessageHandler mqttOutbound() {
        MqttPahoMessageHandler handler =
                new MqttPahoMessageHandler(clientId("tx"), mqttPahoClientFactory());
        handler.setDefaultQos(1);
        handler.setDefaultRetained(false);
        return handler;
    }

    /**
     * Creates the direct channel receiving inbound device MQTT messages.
     *
     * @return inbound {@link MessageChannel}
     */
    @Bean
    public MessageChannel mqttInputChannel(){
        return new DirectChannel();
    }

    /**
     * Subscribes to all {@link EntryTopics} wildcard filters under {@link MqttProperties#topicPrefix()}
     * at QoS 1 and forwards payloads to {@link #mqttInputChannel()}.
     *
     * @return configured inbound {@link MessageProducer}
     */
    @Bean
    public MessageProducer mqttInbound() {
        String[] topicos = Arrays.stream(EntryTopics.values())
                .map(t -> t.padrao(properties.topicPrefix()))
                .toArray(String[]::new);

        MqttPahoMessageDrivenChannelAdapter adapter =
                new MqttPahoMessageDrivenChannelAdapter(
                        clientId("rx"), mqttPahoClientFactory(), topicos);

        adapter.setConverter(new DefaultPahoMessageConverter());
        adapter.setQos(1);
        adapter.setOutputChannel(mqttInputChannel());
        return adapter;
    }



}
