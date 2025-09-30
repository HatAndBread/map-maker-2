import calculations from "./calcuations.js";

const generateElevationProfileForRoute = (route) => {
  if (!Array.isArray(route) || route.length === 0) return [];

  const totalDistanceMeters = calculations.routeDistance(route);

  // Width in CSS pixels; use at least 2 samples (start/end)
  const screenWidth = Math.max(2, Math.floor(window.innerWidth || 0));

  // Early return if route has no measurable length
  if (totalDistanceMeters <= 0) {
    const first = route[0];
    const ele = calculations.elevation(first.lon, first.lat);
    return new Array(screenWidth).fill(null).map((_, i) => ({ ele, distance: (i / (screenWidth - 1)) * 0 }));
  }

  // Helper to interpolate along a segment
  const lerp = (a, b, t) => a + (b - a) * t;

  // Build samples by walking the route once with a moving segment pointer
  const samples = new Array(screenWidth);
  let segIndex = 0;
  let segStartCum = 0; // cumulative distance at start of current segment

  // Precompute first segment length if possible
  const segLength = (i) => calculations.distance(route[i], route[i + 1]);
  let currentSegLen = route.length > 1 ? segLength(0) : 0;

  for (let px = 0; px < screenWidth; px++) {
    const target = (px / (screenWidth - 1)) * totalDistanceMeters;

    // Advance to the segment that contains 'target'
    while (segIndex < route.length - 1 && segStartCum + currentSegLen < target) {
      segStartCum += currentSegLen;
      segIndex++;
      currentSegLen = segIndex < route.length - 1 ? segLength(segIndex) : 0;
    }

    const a = route[Math.min(segIndex, route.length - 1)];
    const b = route[Math.min(segIndex + 1, route.length - 1)] || a;

    let t = 0;
    if (currentSegLen > 0) {
      t = (target - segStartCum) / currentSegLen;
      if (!Number.isFinite(t)) t = 0;
      t = Math.max(0, Math.min(1, t));
    }

    const lon = lerp(a.lon, b.lon, t);
    const lat = lerp(a.lat, b.lat, t);
    let ele = calculations.elevation(lon, lat);
    if (!ele) {
        // Find the closest point in the route and use its elevation
        const distFromA = Math.max(0, target - segStartCum);
        const distToB = Math.max(0, segStartCum + currentSegLen - target);
        const preferA = distFromA <= distToB;
        const nearest = preferA ? a : b;
        if (nearest && Number.isFinite(nearest.ele)) {
          ele = nearest.ele;
        } else {
          // Search outward from the current segment for the nearest point with a finite elevation
          let li = segIndex;
          let ri = segIndex + 1;
          while (!Number.isFinite(ele) && (li >= 0 || ri < route.length)) {
            if (li >= 0 && route[li] && Number.isFinite(route[li].ele)) {
              ele = route[li].ele;
              break;
            }
            if (ri < route.length && route[ri] && Number.isFinite(route[ri].ele)) {
              ele = route[ri].ele;
              break;
            }
            li--;
            ri++;
          }
        }
        if (!Number.isFinite(ele)) ele = 0;
    }

    samples[px] = { ele, distance: target, lon, lat };
  }

  return samples;
};

export default generateElevationProfileForRoute;