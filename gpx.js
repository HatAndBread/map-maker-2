export const parseGpx = (rawGpx) => {
//   console.log(rawGpx);
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawGpx, "application/xml");
  const trackSegments = doc.getElementsByTagName("trkseg");
  const routes = new Array(trackSegments.length);
  for (let i = 0; i < trackSegments.length; i++) {
    const trackSegment = trackSegments[i];
    const trackPoints = trackSegment.getElementsByTagName("trkpt");
    const trackPointsArray = []
    for (let j = 0; j < trackPoints.length; j++) {
      const trackPoint = trackPoints[j];
      const lat = trackPoint.getAttribute("lat");
      const lon = trackPoint.getAttribute("lon");
      const eleTag = trackPoint.getElementsByTagName("ele")?.[0];
      const ele = eleTag ? Number(eleTag.textContent).toFixed(1) : null;
      const ext = trackPoint.getElementsByTagName("extensions")?.[0];
      const isControlPoint = ext ? !!ext.getElementsByTagNameNS("*", "isControlPoint")?.[0]?.textContent : false;
      trackPointsArray[j] = { lat, lon, ele, isControlPoint };
    }
    routes[i] = trackPointsArray;
  }
  return routes;
};
