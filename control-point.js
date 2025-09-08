export class ControlPointManager {
  constructor({ map, routes }) {
    this.map = map;
    this.routes = routes;
    this.controlPoints = [];
  }

  add({ routeIndex, index, lat, lon }) {
    const controlPoint = new ControlPoint({ index, lat, lon });
    this.controlPoints[routeIndex] ||= [];
    this.controlPoints[routeIndex][index] = controlPoint;
    controlPoint.marker.addTo(this.map);
  }

  update() {
    this.routes.forEach((route, routeIndex) => {
      route.forEach(({ lat, lon, isControlPoint }, index) => {
        const controlPoint = this.controlPoints[routeIndex]?.[index];
        if (isControlPoint && !controlPoint) {
          this.add({ routeIndex, index, lat, lon });
        } else if (!isControlPoint && controlPoint) {
          controlPoint.marker.remove();
          this.controlPoints[routeIndex][index] = undefined;
        }
      });
      this.controlPoints[routeIndex]?.forEach((controlPoint, index) => {
        if (controlPoint && index > route.length - 1) {
          controlPoint.marker.remove();
          this.controlPoints[routeIndex][controlPoint.index] = undefined;
        }
      });
    });
  }
}

export class ControlPoint {
  constructor({ index, lat, lon }) {
    this.index = index;
    this.lat = lat;
    this.lon = lon;
    const el = document.createElement("div");
    el.textContent = "◎";
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.fontSize = "12px";
    this.marker = new mapboxgl.Marker(el, { draggable: true }).setLngLat([this.lon, this.lat]);
    this.marker.on("dragend", () => {
      const lngLat = this.marker.getLngLat();
      console.log("New position:", lngLat.lng, lngLat.lat);
    });
  }
}
