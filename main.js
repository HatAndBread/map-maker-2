import { map, resolveStyle, setElevationMarker, unsetElevationMarker } from "./create-map.js";
import { uiElements } from "./ui-elements.js";
import { createState } from "./create-state.js";
import { storage } from "./storage.js";
import calculations from "./calcuations.js";
import { parseGpx, routeToGpx } from "./gpx.js";
import { setRoutesData, setupStreetViewDrag } from "./create-map.js";
import getDirections, { MAPBOX_PROFILES } from "./directions.js";
import { Undo } from "./undo.js";
import { ControlPointManager } from "./control-point.js";
import { haptic } from "./haptic.js";
import { showSuccessPulse } from "./visuals.js";
import { authenticateAndCreateGoogleDoc, pickAndOpenGpx, getFileById } from "./google.js";
import generateElevationProfileForRoute from "./elevation_profile.js";

export const undoManager = new Undo();
const params = new URLSearchParams(window.location.search);
const fileId = params.get("id");
if (fileId) {
  const handleFailure = (e) => {
    console.error(e);
    params.delete("id");
    window.location.search = params.toString();
  };
  getFileById(fileId)
    .then((text) => {
      try {
        const routes = parseGpx(text);
        state.routes = routes;
      } catch (e) {
        handleFailure(e);
      }
    })
    .catch((e) => {
      handleFailure(e);
    });
}

export const closeToolboxIfMobile = () => {
  if (uiElements.toolboxMore?.open && window.innerWidth <= 480) {
    uiElements.toolboxMore.open = false;
  }
};
const setRouteDistanceText = () => {
  const route = state.routes[state.currentEditingRoute];
  const distance = calculations.routeDistance(route);
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
    routes: storage.latestRoutes || [[]],
    currentEditingRoute: 0,
    straightLine: false,
    mapboxProfile: MAPBOX_PROFILES[0],
    filename: null,
    measurementSystem: storage.measurementSystem,
    isDisplayOnly: params.get("displayOnly") === "true",
    isElevationProfileVisible: storage.isElevationProfileVisible || false,
    elevationProfile: null,
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
      if (value && uiElements.saveFileGoogleButton) {
        uiElements.saveFileGoogleButton.disabled = false;
      } else if (uiElements.saveFileGoogleButton) {
        uiElements.saveFileGoogleButton.disabled = true;
      }
    },
    measurementSystem: (value) => {
      if (!uiElements.measurementSystem) return;
      storage.measurementSystem = value;
      uiElements.measurementSystem.value = value;
      setRouteDistanceText();
      setRouteDistance3dText();
      updateElevationText(state.elevation);
      forceMapUpdate();
    },
    elevationProfile: (value) => {
      if (!uiElements.elevationProfile) return;
      uiElements.elevationProfile.innerHTML = "";
      const maxEle = value.reduce((m, p) => (p.ele > m ? p.ele : m), 0);
      const scale = maxEle > 0 ? 100 / maxEle : 1; // fit ~100px height
      uiElements.elevationProfile.innerHTML = value
        .map((point) => {
          const displayEle =
            storage.measurementSystem === "METRIC"
              ? `${point.ele}m`
              : `${calculations.metersToFeet(point.ele).toFixed(2)}ft`;
          const displayDistance =
            storage.measurementSystem === "METRIC"
              ? `${calculations.metersToKilometers(point.distance).toFixed(2)}km`
              : `${calculations.metersToMiles(point.distance).toFixed(2)}mi`;
          return `<div class="elev-bar" style="height:${Math.max(
            1,
            Math.round(point.ele * scale)
          )}px;background-color:#e5e7eb;width:1px" data-elevation="${
            point.ele
          }" data-tooltip="Ele: ${displayEle} Distance: ${displayDistance}" data-lon="${point.lon}" data-lat="${
            point.lat
          }" data-display-elevation="${displayEle}" data-display-distance="${displayDistance}"></div>`;
        })
        .join("");
    },
    routes: (value) => {
      if (!value) {
        console.warn("Tried to set routes to a falsey value");
        return;
      }
      if (value.length === 0) {
        console.warn("Tried to set routes to an empty array");
        return;
      }
      if (
        value.length === 1 &&
        (value[0].length === 0 || value[0].length === 1) &&
        uiElements.toggleElevationProfileButton &&
        state.isElevationProfileVisible
      ) {
        // If the route is empty or has only one point, hide the elevation profile
        uiElements.toggleElevationProfileButton.click();
      }
      setRoutesData(value);
      controlPointManager.routes = value;
      controlPointManager.update();
      setRouteDistanceText();
      setRouteDistance3dText();
      storage.latestRoutes = value;
      uiElements.importModal?.close();
      if (state.isElevationProfileVisible) {
        state.elevationProfile = generateElevationProfileForRoute(value[state.currentEditingRoute]);
      }
    },
    isElevationProfileVisible: (value) => {
      if (!uiElements.toggleElevationProfileButton) return;
      storage.isElevationProfileVisible = value;
      if (!uiElements.elevationProfile) return;
      uiElements.elevationProfile.style.display = value ? "" : "none";
      if (value) {
        state.elevationProfile = generateElevationProfileForRoute(state.routes[state.currentEditingRoute]);
      }
    },
  }
);

export const forceMapUpdate = () => {
  state.routes = state.routes;
};

if (uiElements.measurementSystem) {
  uiElements.measurementSystem.onchange = () => {
    if (!uiElements.measurementSystem) return;
    state.measurementSystem = uiElements.measurementSystem.value;
    closeToolboxIfMobile();
  };
}
if (uiElements.mapStyle) {
  uiElements.mapStyle.onchange = () => {
    if (!uiElements.mapStyle) return;
    storage.mapStyle = uiElements.mapStyle.value;
    map.setStyle(resolveStyle(uiElements.mapStyle.value));
    closeToolboxIfMobile();
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
    closeToolboxIfMobile();
  };
}
if (uiElements.redoButton) {
  uiElements.redoButton.onclick = () => {
    undoManager.redo();
    closeToolboxIfMobile();
  };
}
if (uiElements.straightLine) {
  uiElements.straightLine.checked = false;
  uiElements.straightLine.onchange = () => {
    if (!uiElements.straightLine) return;
    state.straightLine = uiElements.straightLine.checked;
    closeToolboxIfMobile();
  };
}
if (uiElements.mapboxProfile) {
  uiElements.mapboxProfile.value = MAPBOX_PROFILES[0];
  uiElements.mapboxProfile.onchange = () => {
    if (!uiElements.mapboxProfile) return;
    state.mapboxProfile = uiElements.mapboxProfile.value;
    closeToolboxIfMobile();
  };
}
if (uiElements.saveFileButton) {
  uiElements.saveFileButton.disabled = true;
  uiElements.saveFileButton.onclick = () => {
    closeToolboxIfMobile();
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
    if (!uiElements.fileNameInput || !uiElements.saveFileButton || !uiElements.saveFileGoogleButton) return;
    state.filename = uiElements.fileNameInput.value;
    if (!state.filename) {
      uiElements.saveFileButton.disabled = true;
      uiElements.saveFileGoogleButton.disabled = true;
    } else {
      uiElements.saveFileButton.disabled = false;
      uiElements.saveFileGoogleButton.disabled = false;
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
          closeToolboxIfMobile();
        } catch (e) {
          console.error(e);
          closeToolboxIfMobile();
          alert("Error parsing GPX file");
        }
      };
      reader.readAsText(file);
    }
  };
}

if (uiElements.deleteRouteButton) {
  uiElements.deleteRouteButton.onclick = () => {
    const yes = confirm("Are you sure you want to delete this route?");
    if (!yes) return;
    const currentRoute = [...state.routes[state.currentEditingRoute]];
    const redo = () => {
      state.routes[state.currentEditingRoute].length = 0;
      forceMapUpdate();
    };
    const undo = () => {
      currentRoute.forEach((point) => {
        state.routes[state.currentEditingRoute].push(point);
      });
      forceMapUpdate();
    };
    undoManager.add({ undo, redo });
    closeToolboxIfMobile();
  };
}

if (uiElements.reverseRouteButton) {
  uiElements.reverseRouteButton.onclick = () => {
    const redo = () => {
      state.routes[state.currentEditingRoute].reverse();
      forceMapUpdate();
    };
    const undo = () => {
      state.routes[state.currentEditingRoute].reverse();
      forceMapUpdate();
    };
    undoManager.add({ undo, redo });
    closeToolboxIfMobile();
  };
}
if (uiElements.saveFileGoogleButton) {
  uiElements.saveFileGoogleButton.disabled = true;
  uiElements.saveFileGoogleButton.addEventListener("click", (e) => {
    // Prevent the dialog form from submitting or closing prematurely
    e.preventDefault?.();
    e.stopPropagation?.();
    uiElements.saveModal?.close();
    authenticateAndCreateGoogleDoc();
  });
}
if (uiElements.googleDocsOpenButton) {
  uiElements.googleDocsOpenButton.addEventListener("click", () => {
    pickAndOpenGpx();
    closeToolboxIfMobile();
  });
}

if (uiElements.openSaveModalButton) {
  uiElements.openSaveModalButton.addEventListener("click", () => {
    if (!uiElements.saveModal) return;
    uiElements.saveModal.showModal();
  });
}
if (uiElements.importModalOpenButton) {
  uiElements.importModalOpenButton.addEventListener("click", () => {
    if (!uiElements.importModal) return;
    uiElements.importModal.showModal();
  });
}
if (uiElements.copyShareLinkButton) {
  uiElements.copyShareLinkButton.addEventListener("click", () => {
    if (!uiElements.shareLink || !uiElements.shareLink.textContent) return;
    navigator.clipboard.writeText(uiElements.shareLink.textContent);
  });
}
if (uiElements.toggleElevationProfileButton) {
  uiElements.toggleElevationProfileButton.addEventListener("click", () => {
    state.isElevationProfileVisible = !state.isElevationProfileVisible;
    closeToolboxIfMobile();
  });
}

if (uiElements.elevationProfile) {
  if (state.isElevationProfileVisible) {
    uiElements.elevationProfile.style.display = "";
  } else {
    uiElements.elevationProfile.style.display = "none";
  }
  // Prevent browser navigation gestures on mobile while interacting
  uiElements.elevationProfile.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
    },
    { passive: false }
  );
  uiElements.elevationProfile.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
    },
    { passive: false }
  );
  uiElements.elevationProfile.addEventListener("pointermove", (e) => {
    closeToolboxIfMobile();
    e.stopPropagation();
    e.preventDefault();
    // @ts-ignore
    const dataset = e.relatedTarget?.dataset || {};
    const { lon, lat, displayElevation, displayDistance } = dataset;
    if (lon && lat && displayElevation && displayDistance) {
      if (!lon || !lat) return;
      map.setCenter([lon, lat]);
      setElevationMarker(lon, lat, displayElevation, displayDistance);
    } else {
      for (let i = window.innerHeight; i > 0; i--) {
        const element = document.elementFromPoint(e.clientX, i);
        if (element?.classList.contains("elev-bar")) {
          // @ts-ignore
          const { lon, lat, displayElevation, displayDistance } = element.dataset;
          map.setCenter([lon, lat]);
          setElevationMarker(lon, lat, displayElevation, displayDistance);
          break;
        }
      }
    }
  });
  uiElements.elevationProfile.addEventListener("pointerout", () => {
    unsetElevationMarker();
  });
}

["mousemove", "touchmove"].forEach((event) => {
  map.on(event, (e) => {
    state.elevation = calculations.elevation(e.lngLat.lng, e.lngLat.lat);
    state.pointerLng = e.lngLat.lng.toFixed(4);
    state.pointerLat = e.lngLat.lat.toFixed(4);
  });
});

const controlPointManager = new ControlPointManager({ map, routes: state.routes });

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
  closeToolboxIfMobile();
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
  const { currentEditingRoute } = state;
  const currentRouteLength = state.routes[currentEditingRoute].length;
  if (currentRouteLength > 0) {
    const start = state.routes[currentEditingRoute][currentRouteLength - 1];
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
        state.routes[currentEditingRoute].push(...points);
        state.routes[currentEditingRoute].push({ lon: end.lon, lat: end.lat, ele: end.ele, isControlPoint: true });
        forceMapUpdate();
      };
      const undo = () => {
        const removeCount = points.length + 1;
        for (let i = 0; i < removeCount; i++) state.routes[currentEditingRoute].pop();
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
            state.routes[currentEditingRoute].push(coordinate);
          });
          forceMapUpdate();
        };
        const undo = () => {
          for (let i = coords.length - 1; i >= 0; i--) {
            state.routes[currentEditingRoute].pop();
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
      state.routes[currentEditingRoute].push(value);
      forceMapUpdate();
    };
    const undo = () => {
      state.routes[currentEditingRoute].pop();
      forceMapUpdate();
    };
    undoManager.add({ undo, redo });
  }
  haptic();
});

map.on("mouseup", () => {
  clearLongMouseTimer();
});

let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (state.isElevationProfileVisible) {
      state.elevationProfile = generateElevationProfileForRoute(state.routes[state.currentEditingRoute]);
    }
  }, 200);
});
