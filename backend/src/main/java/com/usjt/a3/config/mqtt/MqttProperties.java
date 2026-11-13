package com.usjt.a3.config.mqtt;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Externalized and bean-validated MQTT connection properties bound under {@code mqtt.*}.
 *
 * @param brokerUrl      MQTT broker URI (e.g. {@code tcp://localhost:1883})
 * @param topicPrefix    base topic namespace shared across farm devices
 * @param clientIdPrefix prefix used to derive split TX/RX MQTT client IDs
 */
@Validated
@ConfigurationProperties(prefix = "mqtt")
public record MqttProperties(
        @NotBlank String brokerUrl,
        @NotBlank String topicPrefix,
        @NotBlank String clientIdPrefix
) {
}
