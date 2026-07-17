// Browser geolocation + reverse geocode (no API key).

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km) {
  const miles = km * 0.621371;
  if (miles < 0.1) return `${Math.round(miles * 5280)} ft`;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles).toLocaleString()} mi`;
}

export async function reverseGeocode(lat, lng) {
  const lang = (navigator.language || 'en').split('-')[0];
  const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client');
  url.searchParams.set('latitude', lat);
  url.searchParams.set('longitude', lng);
  url.searchParams.set('localityLanguage', lang);
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not resolve place name');
  const data = await res.json();
  return data.city || data.locality || data.principalSubdivision || data.countryName || 'Unknown place';
}

/** Fresh GPS preferred — stale browser caches were keeping old cities after travel. */
const FRESH = { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 };
/** ~3km — enough to drop a stale city name before reverse-geocode finishes. */
const MOVE_KM = 3;

export function watchGeo(onUpdate, opts = {}) {
  if (!navigator.geolocation) {
    onUpdate({ error: 'Geolocation is not supported in this browser.' });
    return () => {};
  }

  const options = { ...FRESH, ...opts, maximumAge: 0 };
  let last = null; // { lat, lng, place }
  let cancelled = false;
  let watchId = null;

  const handle = async pos => {
    if (cancelled) return;
    const { latitude: lat, longitude: lng } = pos.coords;
    const moved = !last || haversineKm(last.lat, last.lng, lat, lng) >= MOVE_KM;
    // Drop the old city immediately when you move — don't keep "Tunisia" over Aachen coords.
    const place = moved ? null : (last?.place ?? null);
    last = { lat, lng, place };
    onUpdate({ lat, lng, place, accuracy: pos.coords.accuracy, moved });

    try {
      const resolved = await reverseGeocode(lat, lng);
      if (cancelled) return;
      // Ignore a late geocode if GPS has already moved on.
      if (haversineKm(last.lat, last.lng, lat, lng) >= MOVE_KM) return;
      last = { lat, lng, place: resolved };
      onUpdate({ lat, lng, place: resolved, accuracy: pos.coords.accuracy });
    } catch (e) {
      if (cancelled) return;
      onUpdate({
        lat: last.lat, lng: last.lng, place: last.place,
        accuracy: pos.coords.accuracy, geocodeError: e.message
      });
    }
  };

  const fail = err => {
    if (cancelled) return;
    const msg = err.code === 1
      ? 'Location permission denied'
      : err.code === 2
        ? 'Location unavailable'
        : 'Location request timed out';
    onUpdate({ error: msg });
  };

  const refresh = () => {
    navigator.geolocation.getCurrentPosition(handle, fail, options);
  };

  refresh();
  watchId = navigator.geolocation.watchPosition(handle, fail, options);

  // Coming back to the tab / app: force a brand-new fix (don't trust cache).
  const onVisible = () => {
    if (document.visibilityState === 'visible') refresh();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pageshow', refresh);

  return () => {
    cancelled = true;
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('pageshow', refresh);
  };
}
