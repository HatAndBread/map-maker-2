import calculations from "./calcuations.js";

export const parseGpx = (rawGpx) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawGpx, "application/xml");
  const trackSegments = doc.getElementsByTagName("trkseg");
  const routes = new Array(trackSegments.length);
  for (let i = 0; i < trackSegments.length; i++) {
    const trackSegment = trackSegments[i];
    const trackPoints = trackSegment.getElementsByTagName("trkpt");
    const trackPointsArray = [];
    for (let j = 0; j < trackPoints.length; j++) {
      const trackPoint = trackPoints[j];
      const lat = Number(trackPoint.getAttribute("lat"));
      const lon = Number(trackPoint.getAttribute("lon"));
      const eleTag = trackPoint.getElementsByTagName("ele")?.[0];
      const ele = eleTag ? Number(Number(eleTag.textContent).toFixed(1)) : calculations.elevation(lon, lat);

      const ext = trackPoint.getElementsByTagName("extensions")?.[0];
      const isControlPoint = ext
        ? ext.getElementsByTagNameNS("*", "isControlPoint")?.[0]?.localName === "isControlPoint"
        : false;
      trackPointsArray[j] = { lat, lon, ele, isControlPoint };
    }
    routes[i] = trackPointsArray;
  }
  return routes;
};

export const routeToGpx = (route) => {
  if (!Array.isArray(route) || route.length === 0) {
    return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="map-maker-2" xmlns="http://www.topografix.com/GPX/1/1"></gpx>`;
  }
  const esc = (s) => String(s);
  const trkpts = route
    .filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lon))
    .map((p) => {
      const lat = Number(p.lat).toFixed(6);
      const lon = Number(p.lon).toFixed(6);
      const ele = Number.isFinite(p.ele) ? `<ele>${Number(p.ele).toFixed(1)}</ele>` : "";
      const isCp = p.isControlPoint ? `<extensions><isControlPoint>true</isControlPoint></extensions>` : "";
      return `<trkpt lat="${esc(lat)}" lon="${esc(lon)}">${ele}${isCp}</trkpt>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="map-maker-2" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>route</name>
    <trkseg>
      ${trkpts}
    </trkseg>
  </trk>
</gpx>`;
};
