import { map, resolveStyle } from "./create-map.js";
import { uiElements } from "./ui-elements.js";
import { createState } from "./create-state.js";
import { deleteDB, storage } from "./storage.js";
import calculations from "./calcuations.js";
import publicKeys from "./public-keys.js";
import { parseGpx } from "./gpx.js";
import { setRoutesData } from "./create-map.js";
import getDirections from "./directions.js";
import { Undo } from "./undo.js";
import {ControlPointManager} from "./control-point.js";
import { haptic } from "./haptic.js";

export const undoManager = new Undo();
const state = createState(
  {
    elevation: null,
    pointerLng: null,
    pointerLat: null,
    routes: [[]],
    currentEditingRoute: 0,
  },
  {
    elevation: (value) => {
      if (!uiElements.elevationValue || value === null) return;
      const isMetric = storage.measurementSystem === "METRIC";
      value = isMetric ? value : calculations.metersToFeet(value);
      uiElements.elevationValue.textContent =
        value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
        " " +
        (isMetric ? "m" : "ft");
    },
    pointerLng: (value) => {
      if (!uiElements.pointerLng || value === null) return;
      uiElements.pointerLng.textContent = value;
    },
    pointerLat: (value) => {
      if (!uiElements.pointerLat || value === null) return;
      uiElements.pointerLat.textContent = value;
    },
    routes: (value) => {
      setRoutesData(value);
      controlPointManager.update();
    },
  }
);

export const forceMapUpdate = () => {
  state.routes = state.routes;
};

if (uiElements.deleteDBButton) {
  uiElements.deleteDBButton.onclick = () => {
    deleteDB();
  };
}
if (uiElements.measurementSystem) {
  uiElements.measurementSystem.onchange = () => {
    if (!uiElements.measurementSystem) return;
    storage.measurementSystem = uiElements.measurementSystem.value;
  };
}
if (uiElements.mapStyle) {
  uiElements.mapStyle.onchange = () => {
    if (!uiElements.mapStyle) return;
    storage.mapStyle = uiElements.mapStyle.value;
    map.setStyle(resolveStyle(uiElements.mapStyle.value));
  };
}
if (uiElements.streetViewIcon) {
  document.ondragover = (e) => {
    e.preventDefault();
    const ll = map.unproject([e.clientX, e.clientY]);
    state.pointerLng = ll.lng.toFixed(4);
    state.pointerLat = ll.lat.toFixed(4);
  };

  uiElements.streetViewIcon.ondragend = () => {
    addIframe(state.pointerLng, state.pointerLat);
  };
}
if (uiElements.undoButton) {
  uiElements.undoButton.onclick = () => {
    undoManager.undo();
  };
}
if (uiElements.redoButton) {
  uiElements.redoButton.onclick = () => {
    undoManager.redo();
  };
}

if (uiElements.gpxInput) {
  uiElements.gpxInput.onchange = () => {
    if (!uiElements.gpxInput) return;
    const file = uiElements.gpxInput.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (!e.target) return;
        const gpx = e.target.result;
        try {
          const routes = parseGpx(gpx);
          const firstPoint = routes[0]?.[0];
          if (firstPoint) {
            map.setCenter([firstPoint.lon, firstPoint.lat]);
            map.zoomTo(15);
            state.routes = routes;
          }
        } catch (e) {
          console.error(e);
          alert("Error parsing GPX file");
        }
      };
      reader.readAsText(file);
    }
  };
}

["mousemove", "touchmove"].forEach((event) => {
  map.on(event, (e) => {
    state.elevation = map.queryTerrainElevation(e.lngLat);
    state.pointerLng = e.lngLat.lng.toFixed(4);
    state.pointerLat = e.lngLat.lat.toFixed(4);
  });
});

const controlPointManager = new ControlPointManager({ map, routes: state.routes });

const addIframe = (lng, lat) => {
  const container = document.createElement("div");
  const iframe = document.createElement("iframe");
  const closeButton = document.createElement("button");

  closeButton.textContent = "Close";
  closeButton.style.position = "absolute";
  closeButton.style.top = "10px";
  closeButton.style.right = "10px";
  closeButton.style.zIndex = "1001";
  closeButton.style.padding = "8px 16px";
  closeButton.style.backgroundColor = "white";
  closeButton.style.border = "1px solid #ccc";
  closeButton.style.borderRadius = "4px";
  closeButton.style.cursor = "pointer";

  closeButton.onclick = () => {
    container.remove();
  };

  iframe.src = `https://www.google.com/maps/embed/v1/streetview?key=${publicKeys.google}&location=${lat},${lng}`;
  iframe.width = "100%";
  iframe.height = "100%";
  iframe.style.border = "none";
  iframe.loading = "lazy";
  iframe.referrerPolicy = "no-referrer-when-downgrade";

  container.style.position = "absolute";
  container.style.top = "0";
  container.style.left = "0";
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.zIndex = "1000";

  container.appendChild(iframe);
  container.appendChild(closeButton);
  document.body.appendChild(container);
};

let longMouseTimer;
let longTouchTimer;
let mapHeld = false;
export const clearLongMouseTimer = () => {
  if (longMouseTimer) {
    clearTimeout(longMouseTimer);
    longMouseTimer = null;
  }
  if (longTouchTimer) {
    clearTimeout(longTouchTimer);
    longTouchTimer = null;
  }
};
map.on("mousedown", (e) => {
  longMouseTimer = setTimeout(() => {
    mapHeld = true;
    console.log("Long mouse hold detected!", e.lngLat);
    const currentRoute = state.routes[state.currentEditingRoute];
    if (currentRoute.length < 2) return;
    const px = e.lngLat.lng;
    const py = e.lngLat.lat;
    let bestPoint = null;
    let bestPointIndex = 0;
    let bestD2 = Infinity;
    for (let i = 0; i < currentRoute.length - 1; i++) {
      const a = currentRoute[i];
      const b = currentRoute[i + 1];
      if (!a || !b) continue;
      if (!Number.isFinite(a.lon) || !Number.isFinite(a.lat) || !Number.isFinite(b.lon) || !Number.isFinite(b.lat))
        continue;
      const ax = a.lon;
      const ay = a.lat;
      const bx = b.lon;
      const by = b.lat;
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      let t = 0;
      if (len2 > 0) {
        t = ((px - ax) * dx + (py - ay) * dy) / len2;
        // Clamp to the segment (endpoints allowed)
        t = Math.max(0, Math.min(1, t));
      }
      const qx = ax + t * dx;
      const qy = ay + t * dy;
      const dqx = qx - px;
      const dqy = qy - py;
      const d2 = dqx * dqx + dqy * dqy;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestPointIndex = i;
        bestPoint = { lon: qx, lat: qy };
      }
    }
    if (!bestPoint) return;
    const distanceToBestPoint = calculations.distance(bestPoint, { lon: e.lngLat.lng, lat: e.lngLat.lat });
    console.log({ bestPoint, distanceToBestPoint, bestPointIndex });

    if (distanceToBestPoint > 10) return;
    haptic();
    // insert a lng/lat between the indexes of the best and second best points
    const redo = () => {
      const newPoint = { lon: bestPoint.lon, lat: bestPoint.lat, isControlPoint: true };
      currentRoute.splice(bestPointIndex + 1, 0, newPoint);
      forceMapUpdate();
    };
    const undo = () => {
      currentRoute.splice(bestPointIndex + 1, 1);
      forceMapUpdate();
    };
    undoManager.add({ undo, redo });
  }, 500); // 500ms threshold
});

map.on("mouseup", () => {
  clearLongMouseTimer();
});

map.on("move", () => {
  clearLongMouseTimer();
});
map.on("touchstart", (e) => {
  longTouchTimer = setTimeout(() => {}, 500); // 500ms threshold
});

map.on("click", (e) => {
  if (mapHeld) {
    mapHeld = false;
    return;
  }
  const editingRoute = state.routes[state.currentEditingRoute];
  if (editingRoute.length > 0) {
    const start = editingRoute[editingRoute.length - 1];
    const end = {
      lon: e.lngLat.lng,
      lat: e.lngLat.lat,
    };
    getDirections(start, end)
      .then((data) => {
        if (!data.routes) {
          throw new Error("No routes found");
        }
        const coordinates = data.routes[0].geometry?.coordinates;
        if (!coordinates) return;
        coordinates.shift();
        const coords = coordinates.map((coordinate, i) => ({
          lon: coordinate[0],
          lat: coordinate[1],
          isControlPoint: i === coordinates.length - 1,
        }));
        const redo = () => {
          coords.forEach((coordinate) => {
            editingRoute.push(coordinate);
          });
          forceMapUpdate();
        };
        const undo = () => {
          for (let i = coords.length - 1; i >= 0; i--) {
            editingRoute.pop();
          }
          forceMapUpdate();
        };
        undoManager.add({ undo, redo });
      })
      .catch((error) => {
        console.error(error);
        alert("Error getting directions");
      });
  } else {
    const redo = () => {
      const value = {
        lon: e.lngLat.lng,
        lat: e.lngLat.lat,
        isControlPoint: true,
      };
      editingRoute.push(value);
      forceMapUpdate();
    };
    const undo = () => {
      editingRoute.pop();
      forceMapUpdate();
    };
    undoManager.add({ undo, redo });
  }
  console.log(state.routes);
});

map.on("mouseup", () => {
  clearLongMouseTimer();
});
