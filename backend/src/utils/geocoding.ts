import http from 'http';
import https from 'https';

/**
 * Perform reverse geocoding to convert GPS coordinates (lat, lng) into a human-readable address.
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) {
    return 'Location Not Available';
  }

  const fallbackAddress = `${latitude.toFixed(5)}°, ${longitude.toFixed(5)}°`;

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
    
    const fetchPromise = new Promise<string>((resolve) => {
      const req = https.get(url, {
        headers: {
          'User-Agent': 'inkCRM-Enterprise-App/1.0 (contact@inkworldwide.com)'
        },
        timeout: 3500
      }, (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const parsed = JSON.parse(rawData);
              if (parsed && parsed.display_name) {
                resolve(parsed.display_name);
                return;
              }
            }
          } catch (e) {
            // ignore
          }
          resolve(fallbackAddress);
        });
      });

      req.on('error', () => resolve(fallbackAddress));
      req.on('timeout', () => {
        req.destroy();
        resolve(fallbackAddress);
      });
    });

    return await fetchPromise;
  } catch (err) {
    return fallbackAddress;
  }
}
