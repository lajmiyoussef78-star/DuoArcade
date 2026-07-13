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
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString()} km`;
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

export function watchGeo(onUpdate, { enableHighAccuracy = false, maximumAge = 120000 } = {}) {
  if (!navigator.geolocation) {
    onUpdate({ error: 'Geolocation is not supported in this browser.' });
    return () => {};
  }

  let busy = false;
  const handle = async pos => {
    if (busy) return;
    busy = true;
    try {
      const { latitude: lat, longitude: lng } = pos.coords;
      const place = await reverseGeocode(lat, lng);
      onUpdate({ lat, lng, place, accuracy: pos.coords.accuracy });
    } catch (e) {
      onUpdate({ error: e.message || 'Location lookup failed' });
    } finally {
      busy = false;
    }
  };

  const fail = err => {
    const msg = err.code === 1
      ? 'Location permission denied'
      : err.code === 2
        ? 'Location unavailable'
        : 'Location request timed out';
    onUpdate({ error: msg });
  };

  navigator.geolocation.getCurrentPosition(handle, fail, { enableHighAccuracy, maximumAge, timeout: 15000 });
  const id = navigator.geolocation.watchPosition(handle, fail, { enableHighAccuracy, maximumAge, timeout: 15000 });
  return () => navigator.geolocation.clearWatch(id);
}
