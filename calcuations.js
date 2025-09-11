export default {
  metersToFeet: (meters) => meters * 3.28084,
  distance: (a, b) => {
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
};
