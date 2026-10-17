package com.usjt.a3.service;

import com.usjt.a3.model.enums.ComandResult;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;


@Service
@Slf4j
public class AckService {

    private static final long DEFAULT_ACK_TIMEOUT_MS = 10000;
    private final ConcurrentHashMap<UUID, CompletableFuture<ComandResult>> pendingAck = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<UUID, String> deviceAckResult = new ConcurrentHashMap<>();


    public void registerAck(UUID uuid, String deviceId) {
        pendingAck.putIfAbsent(uuid, new CompletableFuture<>());
        deviceAckResult.putIfAbsent(uuid, deviceId);
    }


    public ComandResult awaitAck(UUID uuid) {
        CompletableFuture<ComandResult> future = pendingAck.computeIfAbsent(uuid, k -> new CompletableFuture<>());
        try {
            return future.get(DEFAULT_ACK_TIMEOUT_MS, TimeUnit.MILLISECONDS);
        } catch (TimeoutException e){
            return ComandResult.TIMEOUT;
        } catch (Exception e) {
            return ComandResult.FAILED;
        } finally {
            pendingAck.remove(uuid, future);
            deviceAckResult.remove(uuid);
        }
    }

    public void resolvedAck(UUID uuid, String deviceId, ComandResult result) {
        String expectedDeviceId = deviceAckResult.get(uuid);

        if (expectedDeviceId == null  ||!expectedDeviceId.equalsIgnoreCase(deviceId)) {
            return;
        }
        resolvedAck(uuid, result);
    }

    public void resolvedAck(UUID uuid, ComandResult result) {
        CompletableFuture<ComandResult> future = pendingAck.get(uuid);
        if (future != null) {
            future.complete(result);
        }
    }


}
