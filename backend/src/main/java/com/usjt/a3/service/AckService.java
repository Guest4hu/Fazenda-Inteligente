package com.usjt.a3.service;

import com.usjt.a3.model.enums.ComandResult;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;


/**
 * Thread-safe in-memory coordinator for correlating asynchronous MQTT pump command acknowledgments.
 *
 * <p>Uses {@link CompletableFuture} entries keyed by command UUID alongside expected device MAC addresses
 * so HTTP callers can synchronously await hardware confirmation up to {@value #DEFAULT_ACK_TIMEOUT_MS} ms.</p>
 */
@Service
@Slf4j
public class AckService {

    private static final long DEFAULT_ACK_TIMEOUT_MS = 10000;
    private final ConcurrentHashMap<UUID, CompletableFuture<ComandResult>> pendingAck = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<UUID, String> deviceAckResult = new ConcurrentHashMap<>();


    /**
     * Pre-registers a pending acknowledgment slot bound to the target device MAC before publishing via MQTT,
     * eliminating the race between publishing and fast ESP32 responses.
     *
     * @param uuid unique command identifier
     * @param deviceId normalized target device MAC address
     */
    public void registerAck(UUID uuid, String deviceId) {
        pendingAck.putIfAbsent(uuid, new CompletableFuture<>());
        deviceAckResult.putIfAbsent(uuid, deviceId);
    }


    /**
     * Blocks the calling thread until the device acknowledges the command or the 10-second timeout expires.
     *
     * <p>Always removes both correlation entries in {@code finally} to prevent memory leaks.</p>
     *
     * @param uuid command identifier to wait for
     * @return {@link ComandResult#SUCCESS} on device confirmation, {@link ComandResult#TIMEOUT}, or {@link ComandResult#FAILED}
     */
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

    /**
     * Resolves a pending acknowledgment only if the reporting device MAC matches the registered target MAC.
     *
     * @param uuid acknowledged command identifier
     * @param deviceId reporting device MAC address (compared case-insensitively)
     * @param result execution outcome reported by the hardware
     */
    public void resolvedAck(UUID uuid, String deviceId, ComandResult result) {
        String expectedDeviceId = deviceAckResult.get(uuid);

        if (expectedDeviceId == null  ||!expectedDeviceId.equalsIgnoreCase(deviceId)) {
            return;
        }
        resolvedAck(uuid, result);
    }

    /**
     * Completes the pending {@link CompletableFuture} associated with the given command UUID if present.
     *
     * @param uuid acknowledged command identifier
     * @param result execution outcome
     */
    public void resolvedAck(UUID uuid, ComandResult result) {
        CompletableFuture<ComandResult> future = pendingAck.get(uuid);
        if (future != null) {
            future.complete(result);
        }
    }


}
