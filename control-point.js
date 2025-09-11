import getDirections from "./directions.js";
import { setSectionPreviewData } from "./create-map.js";
import { forceMapUpdate } from "./main.js";
import { undoManager } from "./main.js";
import { haptic } from "./haptic.js";
import { clearLongMouseTimer } from "./main.js";

export class ControlPointManager {
  constructor({ map, routes }) {
    this.map = map;
    this.routes = routes;
    this.controlPoints = [];
  }

  add({ routeIndex, index, lat, lon }) {
    const controlPoint = new ControlPoint({ index, lat, lon, route: this.routes[routeIndex] });
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
        } else if (isControlPoint && controlPoint) {
          // Ensure existing marker follows updated coordinates
          controlPoint.setPosition(lon, lat);
        } else if (!isControlPoint && controlPoint) {
          controlPoint.remove();
          this.controlPoints[routeIndex][index] = undefined;
        }
      });

      const firstControlIdx = route.findIndex((p) => p && p.isControlPoint);
      let lastControlIdx = -1;
      for (let i = route.length - 1; i >= 0; i--) {
        if (route[i] && route[i].isControlPoint) {
          lastControlIdx = i;
          break;
        }
      }
      // Update icons and clean up orphan markers past route length
      this.controlPoints[routeIndex]?.forEach((controlPoint, index) => {
        if (controlPoint && index > route.length - 1) {
          controlPoint.remove();
          this.controlPoints[routeIndex][controlPoint.index] = undefined;
        }
        if (!controlPoint) return;
        if (index === lastControlIdx) {
          controlPoint.el.textContent = "🏁";
          controlPoint.el.style.fontSize = "12px";
        } else if (index === firstControlIdx) {
          controlPoint.el.textContent = "⚑";
          controlPoint.el.style.fontSize = "16px";
        } else {
          controlPoint.el.textContent = "◎";
          controlPoint.el.style.fontSize = "12px";
        }
      });
    });
  }
}

export class ControlPoint {
  constructor({ index, lat, lon, route }) {
    this.index = index;
    this.lat = lat;
    this.lon = lon;
    this.route = route;
    this.dragRequestId = 0;
    this.applyOnResolveId = 0;
    this.undoToApply = null;
    this.redoToApply = null;
    this.suppressNextClick = false;
    this.lastThrottleTime = null;
    this.el = document.createElement("div");
    this.el.style.display = "flex";
    this.el.style.alignItems = "center";
    this.el.style.justifyContent = "center";
    this.el.style.cursor = "pointer";
    this.marker = new mapboxgl.Marker(this.el, { draggable: true }).setLngLat([this.lon, this.lat]);
    this.marker.on("dragstart", () => {
      clearLongMouseTimer();
      // Invalidate any in-flight requests from a previous drag and clear preview
      this.dragRequestId++;
      this.applyOnResolveId = 0;
      this.undoToApply = null;
      this.redoToApply = null;
      setSectionPreviewData([]);
    });
    this.onDragEnd = () => {
      clearLongMouseTimer();
      const lngLat = this.marker.getLngLat();
      console.log("New position:", lngLat.lng, lngLat.lat);
      setSectionPreviewData([]);
      if (typeof this.undoToApply === "function" && typeof this.redoToApply === "function") {
        undoManager.add({ undo: this.undoToApply, redo: this.redoToApply });
        this.undoToApply = null;
        this.redoToApply = null;
        // Invalidate any in-flight responses so they can't redraw preview
        this.dragRequestId++;
        this.applyOnResolveId = 0;
      } else {
        // no prepared action yet: apply when the last in-flight request resolves
        this.applyOnResolveId = this.dragRequestId;
      }
    };
    this.marker.on("dragend", this.onDragEnd);
    this.onClick = (e) => {
      if (this.suppressNextClick) {
        this.suppressNextClick = false;
        return;
      }
      console.log("Click!");
      clearLongMouseTimer();
      e.stopPropagation();
      const redo = () => {
        this.route[this.index] = { lon: this.lon, lat: this.lat, isControlPoint: false };
        forceMapUpdate();
        haptic();
      };
      const undo = () => {
        this.route[this.index] = { lon: this.lon, lat: this.lat, isControlPoint: true };
        forceMapUpdate();
      };
      undoManager.add({ undo, redo });
    };
    this.el.addEventListener("click", this.onClick);
    this.onDrag = () => {
      this.suppressNextClick = true;
      clearLongMouseTimer();
      const now = Date.now();

      const pointIndex = this.index;
      const routeUpToThisPoint = [...this.route.slice(0, pointIndex)].reverse();
      const routeFromThisPoint = this.route.slice(pointIndex + 1);
      const prevPointIndex = routeUpToThisPoint.findIndex((p) => p.isControlPoint);
      const prevPoint = routeUpToThisPoint[prevPointIndex];
      const nextPointIndex = routeFromThisPoint.findIndex((p) => p.isControlPoint);
      const nextPoint = routeFromThisPoint[nextPointIndex];
      const throttleTime = !nextPoint && !prevPoint ? 0 : 200;
      if (!this.lastThrottleTime || now - this.lastThrottleTime >= throttleTime) {
        this.lastThrottleTime = now;

        const lngLat = this.marker.getLngLat();

        if (prevPoint && !nextPoint) {
          try {
            const reqId = ++this.dragRequestId;
            getDirections({ lat: prevPoint.lat, lon: prevPoint.lon }, { lat: lngLat.lat, lon: lngLat.lng }).then(
              (data) => {
                if (reqId !== this.dragRequestId) return;
                const coordinates = data?.routes?.[0]?.geometry?.coordinates || [];
                coordinates.shift();
                setSectionPreviewData(coordinates);
                // prevPointIndex is from a reversed slice; convert to absolute index in the route
                const prevAbs = pointIndex - (prevPointIndex + 1);
                const insertAt = prevAbs + 1; // insert after the previous control point
                this.redoToApply = () => {
                  this.route.splice(insertAt);
                  coordinates.forEach(([lon, lat], index) => {
                    this.route.push({ lon, lat, isControlPoint: index === coordinates.length - 1 });
                  });
                  forceMapUpdate();
                };
                const routeRef = this.route; // keep a ref to the real array
                const routeSnapshot = [...routeRef];
                this.undoToApply = () => {
                  routeRef.length = 0;
                  routeRef.push(...routeSnapshot);
                  forceMapUpdate();
                };
                if (
                  this.applyOnResolveId === reqId &&
                  typeof this.undoToApply === "function" &&
                  typeof this.redoToApply === "function"
                ) {
                  undoManager.add({ undo: this.undoToApply, redo: this.redoToApply });
                  this.undoToApply = null;
                  this.redoToApply = null;
                  setSectionPreviewData([]);
                }
              }
            );
          } catch (error) {
            console.error(error);
          }
        } else if (!prevPoint && nextPoint) {
          try {
            const reqId = ++this.dragRequestId;
            getDirections({ lat: lngLat.lat, lon: lngLat.lng }, { lat: nextPoint.lat, lon: nextPoint.lon }).then(
              (data) => {
                if (reqId !== this.dragRequestId) return;
                const coordinates = data?.routes?.[0]?.geometry?.coordinates || [];
                setSectionPreviewData(coordinates);

                const routeRef = this.route;
                const routeSnapshot = [...routeRef];
                const points = coordinates.map(([lon, lat], index) => ({ lon, lat, isControlPoint: index === 0 }));
                this.redoToApply = () => {
                  // Replace only the segment BEFORE the next control point; keep the next control point intact
                  const pointIndex = this.index;
                  const nextAbs = routeRef.findIndex((p, i) => i > pointIndex && p && p.isControlPoint);
                  const deleteCount = nextAbs >= 0 ? nextAbs : 0;
                  routeRef.splice(0, deleteCount, ...points);
                  forceMapUpdate();
                };
                this.undoToApply = () => {
                  routeRef.length = 0;
                  routeRef.push(...routeSnapshot);
                  console.log(routeRef);
                  forceMapUpdate();
                };
                if (
                  this.applyOnResolveId === reqId &&
                  typeof this.undoToApply === "function" &&
                  typeof this.redoToApply === "function"
                ) {
                  undoManager.add({ undo: this.undoToApply, redo: this.redoToApply });
                  this.undoToApply = null;
                  this.redoToApply = null;
                  setSectionPreviewData([]);
                }
              }
            );
          } catch (error) {
            console.error(error);
          }
        } else if (prevPoint && nextPoint) {
          try {
            const reqId = ++this.dragRequestId;
            getDirections(
              { lat: prevPoint.lat, lon: prevPoint.lon },
              { lat: nextPoint.lat, lon: nextPoint.lon },
              { lat: lngLat.lat, lon: lngLat.lng }
            ).then((data) => {
              if (reqId !== this.dragRequestId) return;
              const coordinates = data?.routes?.[0]?.geometry?.coordinates || [];
              coordinates.shift();
              setSectionPreviewData(coordinates);

              // compute absolute indices for replacement between prev and next control points
              const pointIndex = this.index;
              const routeUpToThisPoint = [...this.route.slice(0, pointIndex)].reverse();
              const routeFromThisPoint = this.route.slice(pointIndex + 1);
              const prevPointIndex = routeUpToThisPoint.findIndex((p) => p.isControlPoint);
              const nextPointIndex = routeFromThisPoint.findIndex((p) => p.isControlPoint);
              const prevAbs = pointIndex - (prevPointIndex + 1);
              const nextAbs = pointIndex + 1 + nextPointIndex;

              const start = prevAbs + 1; // after prev control point
              const deleteCount = Math.max(0, nextAbs - start);

              const routeRef = this.route;
              const routeSnapshot = [...routeRef];
              const points = coordinates.map(([lon, lat]) => ({ lon, lat, isControlPoint: false }));
              // mark the inserted point closest to drag position as a control point
              if (points.length > 0) {
                let minIdx = 0;
                let minDist = Infinity;
                for (let i = 0; i < points.length; i++) {
                  const dx = points[i].lon - lngLat.lng;
                  const dy = points[i].lat - lngLat.lat;
                  const d2 = dx * dx + dy * dy;
                  if (d2 < minDist) {
                    minDist = d2;
                    minIdx = i;
                  }
                }
                points[minIdx].isControlPoint = true;
              }
              this.redoToApply = () => {
                routeRef.splice(start, deleteCount, ...points);
                forceMapUpdate();
              };
              this.undoToApply = () => {
                routeRef.length = 0;
                routeRef.push(...routeSnapshot);
                forceMapUpdate();
              };
              if (
                this.applyOnResolveId === reqId &&
                typeof this.undoToApply === "function" &&
                typeof this.redoToApply === "function"
              ) {
                undoManager.add({ undo: this.undoToApply, redo: this.redoToApply });
                this.undoToApply = null;
                this.redoToApply = null;
                setSectionPreviewData([]);
              }
            });
          } catch (error) {
            console.error(error);
          }
        } else {
          // Only this control point exists; move it to the dragged location
          setSectionPreviewData([]);

          const routeRef = this.route;
          const routeSnapshot = [...routeRef];

          this.redoToApply = () => {
            routeRef[pointIndex] = { lon: lngLat.lng, lat: lngLat.lat, isControlPoint: true };
            forceMapUpdate();
          };
          this.undoToApply = () => {
            routeRef.length = 0;
            routeRef.push(...routeSnapshot);
            forceMapUpdate();
          };
        }
      }
    };
    this.marker.on("drag", this.onDrag);
  }

  remove() {
    this.marker.remove();
    this.el.removeEventListener("click", this.onClick);
    this.marker.off("drag", this.onDrag);
    this.marker.off("dragend", this.onDragEnd);
    this.el.remove();
  }

  setPosition(lon, lat) {
    this.lon = lon;
    this.lat = lat;
    this.marker.setLngLat([lon, lat]);
  }
}
