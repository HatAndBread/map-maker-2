import { map } from "./create-map.js";
export default {
  metersToFeet(meters) {
    return meters * 3.28084;
  },
  metersToKilometers(meters) {
    return meters / 1000;
  },
  metersToMiles(meters) {
    return meters / 1609.344;
  },
  distance(a, b) {
    const R = 6371e3; // Earth radius in meters
    const toRad = (d) => (d * Math.PI) / 180;

    const φ1 = toRad(a.lat);
    const φ2 = toRad(b.lat);
    const Δφ = toRad(b.lat - a.lat);
    const Δλ = toRad(b.lon - a.lon);

    const sinΔφ = Math.sin(Δφ / 2);
    const sinΔλ = Math.sin(Δλ / 2);

    const h = sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ;

    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

    return R * c; // distance in meters
  },
  elevation(lon, lat) {
    const elevation = map.queryTerrainElevation({ lon, lat }) || 0;
    return Number(elevation.toFixed(1));
  },
  routeDistance(route = []) {
    if (!Array.isArray(route) || route.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i];
      const b = route[i + 1];
      if (!a || !b) continue;
      if (!Number.isFinite(a.lon) || !Number.isFinite(a.lat) || !Number.isFinite(b.lon) || !Number.isFinite(b.lat))
        continue;
      total += this.distance(a, b);
    }
    return total;
  },
  distance3d(a, b) {
    if (!a || !b) return 0;
    if (!Number.isFinite(a.lon) || !Number.isFinite(a.lat) || !Number.isFinite(b.lon) || !Number.isFinite(b.lat))
      return 0;
    const horizontal = this.distance(a, b);
    const elevA = Number.isFinite(a.ele) ? a.ele : this.elevation(a.lon, a.lat);
    const elevB = Number.isFinite(b.ele) ? b.ele : this.elevation(b.lon, b.lat);
    const dz = elevB - elevA;
    return Math.hypot(horizontal, dz);
  },
  routeDistance3d(route = []) {
    if (!Array.isArray(route) || route.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < route.length - 1; i++) {
      total += this.distance3d(route[i], route[i + 1]);
    }
    return total;
  },
};
