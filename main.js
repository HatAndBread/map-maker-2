import { map, resolveStyle } from "./create-map.js";
import { uiElements } from "./ui-elements.js";
import { createState } from "./create-state.js";
import { deleteDB, storage } from "./storage.js";
import calculations from "./calcuations.js";
import publicKeys from "./public-keys.js";
import { parseGpx, routeToGpx } from "./gpx.js";
import { setRoutesData } from "./create-map.js";
import getDirections, { MAPBOX_PROFILES } from "./directions.js";
import { Undo } from "./undo.js";
import { ControlPointManager } from "./control-point.js";
import { haptic } from "./haptic.js";

export const undoManager = new Undo();

const setRouteDistanceText = () => {
  const route = state.routes[state.currentEditingRoute];
  const distance = calculations.routeDistance(route);
  const routeDistance3d = calculations.routeDistance3d(route);
  if (uiElements.distanceValue) {
    uiElements.distanceValue.textContent =
      (state.measurementSystem === "METRIC"
        ? calculations.metersToKilometers(distance)
        : calculations.metersToMiles(distance)
      ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
      " " +
      (state.measurementSystem === "METRIC" ? "km" : "mi");
  }
};
const setRouteDistance3dText = () => {
  const route = state.routes[state.currentEditingRoute];
  const distance = calculations.routeDistance3d(route);
  if (uiElements.distance3dValue) {
    uiElements.distance3dValue.textContent =
      (state.measurementSystem === "METRIC"
        ? calculations.metersToKilometers(distance)
        : calculations.metersToMiles(distance)
      ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
      " " +
      (state.measurementSystem === "METRIC" ? "km" : "mi");
  }
};

const updateElevationText = (elevation) => {
  if (!uiElements.elevationValue || elevation === null) return;
  const isMetric = storage.measurementSystem === "METRIC";
  elevation = isMetric ? elevation : calculations.metersToFeet(elevation);
  uiElements.elevationValue.textContent =
    elevation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
    " " +
    (isMetric ? "m" : "ft");
};
export const state = createState(
  {
    elevation: null,
    pointerLng: null,
    pointerLat: null,
    routes: [[]],
    currentEditingRoute: 0,
    straightLine: false,
    mapboxProfile: MAPBOX_PROFILES[0],
    filename: null,
    measurementSystem: storage.measurementSystem,
  },
  {
    elevation: (value) => {
      updateElevationText(value);
    },
    pointerLng: (value) => {
      if (!uiElements.pointerLng || value === null) return;
      uiElements.pointerLng.textContent = value;
    },
    pointerLat: (value) => {
      if (!uiElements.pointerLat || value === null) return;
      uiElements.pointerLat.textContent = value;
    },
    filename: (value) => {
      if (!uiElements.fileNameInput) return;
      uiElements.fileNameInput.value = value;
      if (value && uiElements.saveFileButton) {
        uiElements.saveFileButton.disabled = false;
      } else if (uiElements.saveFileButton) {
        uiElements.saveFileButton.disabled = true;
      }
    },
    measurementSystem: (value) => {
      if (!uiElements.measurementSystem) return;
      storage.measurementSystem = value;
      uiElements.measurementSystem.value = value;
      setRouteDistanceText();
      setRouteDistance3dText();
      updateElevationText(state.elevation);
    },
    routes: (value) => {
      setRoutesData(value);
      controlPointManager.routes = value;
      controlPointManager.update();
      setRouteDistanceText();
      setRouteDistance3dText();
    },
  }
);

export const forceMapUpdate = () => {
  state.routes = state.routes;
};

// Subtle visual cue at a lng/lat: high-contrast outward ripple (visible beneath a finger)
const showSuccessPulse = (lng, lat) => {
  try {
    const pt = map.project([Number(lng), Number(lat)]);
    const rect = map.getCanvas().getBoundingClientRect();

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "2147483647";
    overlay.style.margin = "0";
    overlay.style.padding = "0";
    overlay.style.border = "0";

    const centerX = rect.left + pt.x;
    const centerY = rect.top + pt.y;

    // Soft dark backdrop to ensure visibility on light map tiles
    const backdrop = document.createElement("div");
    backdrop.style.position = "absolute";
    backdrop.style.left = centerX + "px";
    backdrop.style.top = centerY + "px";
    backdrop.style.width = "28px";
    backdrop.style.height = "28px";
    backdrop.style.transform = "translate(-50%, -50%) scale(0.7)";
    backdrop.style.borderRadius = "50%";
    backdrop.style.background = "rgba(0,0,0,0.28)";
    backdrop.style.filter = "blur(1px)";
    backdrop.style.transition = "transform 640ms ease-out, opacity 640ms ease-out";
    backdrop.style.willChange = "transform, opacity";

    const makeRing = ({ size, border, color, startScale, endScale }) => {
      const r = document.createElement("div");
      r.style.position = "absolute";
      r.style.left = centerX + "px";
      r.style.top = centerY + "px";
      r.style.width = size + "px";
      r.style.height = size + "px";
      r.style.transform = `translate(-50%, -50%) scale(${startScale})`;
      r.style.border = `${border}px solid ${color}`;
      r.style.borderRadius = "50%";
      r.style.boxSizing = "border-box";
      r.style.transition = "transform 640ms ease-out, opacity 640ms ease-out";
      r.style.willChange = "transform, opacity";
      requestAnimationFrame(() => {
        r.style.transform = `translate(-50%, -50%) scale(${endScale})`;
        r.style.opacity = "0";
      });
      return r;
    };

    const darkRing = makeRing({ size: 18, border: 2, color: "rgba(0,0,0,0.55)", startScale: 0.9, endScale: 5.6 });
    const lightRing = makeRing({
      size: 18,
      border: 2,
      color: "rgba(255,255,255,0.95)",
      startScale: 0.8,
      endScale: 6.2,
    });

    overlay.appendChild(backdrop);
    overlay.appendChild(darkRing);
    overlay.appendChild(lightRing);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      backdrop.style.transform = "translate(-50%, -50%) scale(1.6)";
      backdrop.style.opacity = "0";
    });

    setTimeout(() => {
      overlay.remove();
    }, 700);
  } catch (e) {
    // ignore
  }
};

const setupStreetViewDrag = () => {
  const icon = uiElements.streetViewIcon;
  if (!icon) return;
  // improve touch behavior
  icon.style.touchAction = "none";

  let dragging = false;
  /** @type {HTMLElement|null} */
  let ghost = null;
  let wasDragPanEnabled = true;
  /** @type {{x:number,y:number}|null} */
  let dragStartCenter = null;
  /** @type {number} */
  let dragStartMs = 0;

  const getClientFromEvent = (e) => {
    if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.changedTouches && e.changedTouches[0])
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  };

  const cleanupGhosts = () => {
    document.querySelectorAll(".sv-ghost").forEach((n) => n.remove());
  };

  const start = (e) => {
    if (dragging) return;
    dragging = true;
    // disable map panning while dragging icon
    // preserve state to re-enable
    wasDragPanEnabled = map.dragPan.isEnabled();
    if (wasDragPanEnabled) map.dragPan.disable();

    cleanupGhosts();
    // remember the icon's center on screen to allow canceling if dropped back
    const iconRect = icon.getBoundingClientRect();
    dragStartCenter = { x: iconRect.left + iconRect.width / 2, y: iconRect.top + iconRect.height / 2 };
    dragStartMs = Date.now();
    ghost = document.createElement("div");
    ghost.className = "sv-ghost";
    const img = icon.querySelector("img");
    if (img) {
      const gi = /** @type {HTMLImageElement} */ (img.cloneNode(true));
      ghost.appendChild(gi);
    }
    ghost.style.position = "fixed";
    ghost.style.pointerEvents = "none";
    ghost.style.opacity = "0.9";
    ghost.style.zIndex = "10000";
    document.body.appendChild(ghost);
    move(e);
  };

  let lastPreviewMs = 0;
  const move = (e) => {
    if (!dragging || !ghost) return;
    const { x, y } = getClientFromEvent(e);
    ghost.style.left = x - 10 + "px";
    ghost.style.top = y - 10 + "px";
    const lngLat = map.unproject([x, y]);
    if (e.cancelable) e.preventDefault();
    const preview = uiElements.streetviewPreview;
    if (preview) {
      const elapsed = Date.now() - dragStartMs;
      // Only show/update preview after 1s of sustained drag
      if (elapsed < 1000) {
        preview.style.display = "none";
        return;
      }
      preview.style.display = "block";
      const now = Date.now();
      if (now - lastPreviewMs > 2000) {
        lastPreviewMs = now;
        const lat = Number(lngLat.lat.toFixed(5));
        const lng = Number(lngLat.lng.toFixed(5));
        const next = `https://www.google.com/maps/embed/v1/streetview?key=${publicKeys.google}&location=${lat},${lng}`;
        if (preview.src !== next) {
          preview.src = next;
        }
      }
    }
  };

  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    cleanupGhosts();
    ghost = null;
    const preview = uiElements.streetviewPreview;
    if (preview) {
      preview.style.display = "none";
    }

    // compute map lng/lat from drop point and open Street View iframe
    const { x, y } = getClientFromEvent(e);
    // If dropped near the original icon spot, treat as cancel
    if (dragStartCenter) {
      const dx = x - dragStartCenter.x;
      const dy = y - dragStartCenter.y;
      const d2 = dx * dx + dy * dy;
      const cancelRadiusPx = 24;
      if (d2 <= cancelRadiusPx * cancelRadiusPx) {
        // hide preview and restore pan, then exit
        const preview = uiElements.streetviewPreview;
        if (preview) preview.style.display = "none";
        if (wasDragPanEnabled) map.dragPan.enable();
        dragStartCenter = null;
        return;
      }
    }
    dragStartCenter = null;
    const mapEl = uiElements.map;
    if (mapEl) {
      const rect = mapEl.getBoundingClientRect();
      const pt = { x: x - rect.left, y: y - rect.top };
      const lngLat = map.unproject(pt);
      if (lngLat && Number.isFinite(lngLat.lng) && Number.isFinite(lngLat.lat)) {
        addIframe(lngLat.lng, lngLat.lat);
        haptic();
      }
    }

    // restore map panning
    if (wasDragPanEnabled) map.dragPan.enable();
  };

  // Pointer events only (covers mouse + touch on modern browsers)
  icon.addEventListener("pointerdown", start);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
};

if (uiElements.deleteDBButton) {
  uiElements.deleteDBButton.onclick = () => {
    deleteDB();
  };
}
if (uiElements.measurementSystem) {
  uiElements.measurementSystem.onchange = () => {
    if (!uiElements.measurementSystem) return;
    state.measurementSystem = uiElements.measurementSystem.value;
  };
}
if (uiElements.mapStyle) {
  uiElements.mapStyle.onchange = () => {
    if (!uiElements.mapStyle) return;
    storage.mapStyle = uiElements.mapStyle.value;
    map.setStyle(resolveStyle(uiElements.mapStyle.value));
    map.once("style.load", () => {
      forceMapUpdate();
    });
  };
}
if (uiElements.streetViewIcon) {
  // Enable mobile-friendly drag handler
  setupStreetViewDrag();
  document.ondragover = (e) => {
    e.preventDefault();
    const ll = map.unproject([e.clientX, e.clientY]);
    state.pointerLng = ll.lng.toFixed(4);
    state.pointerLat = ll.lat.toFixed(4);
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
if (uiElements.straightLine) {
  uiElements.straightLine.checked = false;
  uiElements.straightLine.onchange = () => {
    if (!uiElements.straightLine) return;
    state.straightLine = uiElements.straightLine.checked;
  };
}
if (uiElements.mapboxProfile) {
  console.log({ mapboxProfile: uiElements.mapboxProfile });
  uiElements.mapboxProfile.value = MAPBOX_PROFILES[0];
  uiElements.mapboxProfile.onchange = () => {
    if (!uiElements.mapboxProfile) return;
    state.mapboxProfile = uiElements.mapboxProfile.value;
  };
}
if (uiElements.saveFileButton) {
  uiElements.saveFileButton.disabled = true;
  uiElements.saveFileButton.onclick = () => {
    if (!state.filename) return;
    const gpx = routeToGpx(state.routes[state.currentEditingRoute]);
    const blob = new Blob([gpx], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = state.filename + ".gpx";
    a.click();
    URL.revokeObjectURL(url);
  };
}
if (uiElements.fileNameInput) {
  uiElements.fileNameInput.value = "";
  uiElements.fileNameInput.oninput = () => {
    if (!uiElements.fileNameInput) return;
    state.filename = uiElements.fileNameInput.value;
    if (!state.filename && uiElements.saveFileButton) {
      uiElements.saveFileButton.disabled = true;
    } else if (uiElements.saveFileButton) {
      uiElements.saveFileButton.disabled = false;
    }
  };
}

if (uiElements.gpxInput) {
  uiElements.gpxInput.value = "";
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
            forceMapUpdate();
          }
          state.filename = file.name.split(".")[0];
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
    state.elevation = calculations.elevation(e.lngLat.lng, e.lngLat.lat);
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
let mapHeld = false;
export const clearLongMouseTimer = () => {
  if (longMouseTimer) {
    clearTimeout(longMouseTimer);
    longMouseTimer = null;
  }
};

document.addEventListener("touchend", (e) => {
  clearLongMouseTimer();
});
const handleMouseDown = (e) => {
  longMouseTimer = setTimeout(() => {
    mapHeld = true;
    const currentRoute = state.routes[state.currentEditingRoute];
    if (currentRoute.length < 2) return;
    let { clientX, clientY } = e;
    if (e.touches && e.touches[0]) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }
    console.log({ clientX, clientY });
    const lngLat = map.unproject([clientX, clientY]);
    const px = lngLat.lng;
    const py = lngLat.lat;
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
    const distanceToBestPoint = calculations.distance(bestPoint, { lon: lngLat.lng, lat: lngLat.lat });

    // Scale snap threshold by zoom, but clamp to avoid overly permissive snaps at low zoom
    const metersPerPixel = (lat, zoom) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
    const pxRadius = 26; // more forgiving finger radius
    const rawMeters = metersPerPixel(lngLat.lat, map.getZoom()) * pxRadius;
    const thresholdMeters = Math.max(8, Math.min(30, rawMeters)); // clamp between 8m and 30m
    if (distanceToBestPoint > thresholdMeters) return;
    haptic();
    // Subtle circular ripple over the inserted control point
    requestAnimationFrame(() => showSuccessPulse(bestPoint.lon, bestPoint.lat));
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
};

document.addEventListener("mousedown", (e) => {
  if (e.target !== map.getCanvas()) {
    return;
  }
  handleMouseDown(e);
});

document.addEventListener("touchstart", (e) => {
  if (e.target !== map.getCanvas()) {
    return;
  }
  handleMouseDown(e);
});

map.on("mouseup", () => {
  clearLongMouseTimer();
});
map.on("touchend", () => {
  clearLongMouseTimer();
});
map.on("touchcancel", () => {
  clearLongMouseTimer();
});

map.on("move", () => {
  clearLongMouseTimer();
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
      ele: calculations.elevation(e.lngLat.lng, e.lngLat.lat),
    };
    if (state.straightLine) {
      const spacingMeters = 10;
      const last = start;
      const totalMeters = calculations.distance(last, end);
      const steps = Math.floor(totalMeters / spacingMeters);
      const points = [];
      if (steps > 0) {
        const dx = end.lon - last.lon;
        const dy = end.lat - last.lat;
        for (let k = 1; k < steps; k++) {
          const t = (k * spacingMeters) / totalMeters;
          const lon = last.lon + t * dx;
          const lat = last.lat + t * dy;
          const ele = calculations.elevation(lon, lat);
          points.push({ lon, lat, ele, isControlPoint: false });
        }
      }
      const redo = () => {
        editingRoute.push(...points);
        editingRoute.push({ lon: end.lon, lat: end.lat, ele: end.ele, isControlPoint: true });
        forceMapUpdate();
      };
      const undo = () => {
        const removeCount = points.length + 1;
        for (let i = 0; i < removeCount; i++) editingRoute.pop();
        forceMapUpdate();
      };
      undoManager.add({ undo, redo });
      return;
    }
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
          ele: coordinate[2],
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
        ele: calculations.elevation(e.lngLat.lng, e.lngLat.lat),
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
  haptic();
  console.log(state.routes);
});

map.on("mouseup", () => {
  clearLongMouseTimer();
});
