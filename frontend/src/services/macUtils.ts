/**
 * src/services/macUtils.ts
 * Normalização e validação de MAC Address para os currais e dispositivos ESP32.
 */

/**
 * Normalizes a MAC address string to exactly 12 uppercase hex characters.
 * Strips colons, hyphens, spaces, and dots.
 * Throws an Error if the resulting string is not a 12-digit hexadecimal.
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
