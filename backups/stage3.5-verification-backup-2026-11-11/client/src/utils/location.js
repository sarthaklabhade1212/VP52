import { Geolocation } from '@capacitor/geolocation';
import { isCapacitorNative } from './api';

/**
 * Checks current location permission state.
 * @returns {Promise<'granted' | 'denied' | 'prompt' | 'error'>}
 */
export async function checkLocationPermission() {
  try {
    if (isCapacitorNative()) {
      const status = await Geolocation.checkPermissions();
      // On Android, status.location or status.coarseLocation may be granted
      if (status.location === 'granted' || status.coarseLocation === 'granted') {
        return 'granted';
      }
      if (status.location === 'denied' || status.coarseLocation === 'denied') {
        return 'denied';
      }
      return 'prompt';
    } else {
      // Browser environment permission check
      if (navigator.permissions && navigator.permissions.query) {
        const status = await navigator.permissions.query({ name: 'geolocation' });
        return status.state; // 'granted', 'denied', 'prompt'
      }
      return 'prompt';
    }
  } catch (err) {
    console.warn('[Location] Check permission error:', err);
    return 'prompt';
  }
}

/**
 * Requests location permission from the device (Android foreground location).
 * @returns {Promise<'granted' | 'denied' | 'error'>}
 */
export async function requestLocationPermission() {
  try {
    if (isCapacitorNative()) {
      const status = await Geolocation.requestPermissions({
        permissions: ['location', 'coarseLocation']
      });
      if (status.location === 'granted' || status.coarseLocation === 'granted') {
        return 'granted';
      }
      return 'denied';
    } else {
      // Web browser request via HTML5 geolocation
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          return resolve('denied');
        }
        navigator.geolocation.getCurrentPosition(
          () => resolve('granted'),
          (err) => {
            if (err.code === err.PERMISSION_DENIED) {
              resolve('denied');
            } else {
              // Position unavailable or timeout, but permission was granted
              resolve('granted');
            }
          },
          { timeout: 8000 }
        );
      });
    }
  } catch (err) {
    console.error('[Location] Request permission error:', err);
    return 'denied';
  }
}

/**
 * Retrieves the user's current foreground location (latitude, longitude).
 * High accuracy enabled with fallback to low accuracy / default.
 * @returns {Promise<{ lat: number, lng: number }>}
 */
export async function getCurrentLocation() {
  const options = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
  };

  try {
    const position = await Geolocation.getCurrentPosition(options);
    if (position && position.coords) {
      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
    }
    throw new Error('No coordinates returned');
  } catch (err) {
    console.warn('[Location] Geolocation.getCurrentPosition failed, trying fallback:', err.message);

    // Fallback attempt with enableHighAccuracy: false
    try {
      const fallbackPos = await Geolocation.getCurrentPosition({
        ...options,
        enableHighAccuracy: false,
        timeout: 15000
      });
      if (fallbackPos && fallbackPos.coords) {
        return {
          lat: fallbackPos.coords.latitude,
          lng: fallbackPos.coords.longitude
        };
      }
    } catch (fallbackErr) {
      console.error('[Location] Fallback location attempt failed:', fallbackErr.message);
    }

    throw err;
  }
}
