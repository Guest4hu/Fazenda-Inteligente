package com.usjt.a3.config.mqtt;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "mqtt")
public record MqttProperties(
        @NotBlank String brokerUrl,
        @NotBlank String topicPrefix,
        @NotBlank String clientIdPrefix
) {
}
