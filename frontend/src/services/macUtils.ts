/**
 * MAC address normalization and format validation utilities for ESP32 corral devices.
 */

/**
 * Normalizes a MAC address string to exactly 12 uppercase hexadecimal characters,
 * stripping colons, hyphens, spaces, and dots.
 *
 * @throws Error when {@code mac} is missing or does not contain exactly 12 hex digits
 */
export function sanitizeMacAddress(mac: string): string {
  if (!mac) {
    throw new Error('MAC address is required');
  }
  const sanitized = mac.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
  if (!/^[0-9A-F]{12}$/.test(sanitized)) {
    throw new Error('MAC address must contain exactly 12 hexadecimal characters (e.g., 240AC4000110)');
  }
  return sanitized;
}
