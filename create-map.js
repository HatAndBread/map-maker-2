import { storage, getStateMemory, removeMemoryHogs } from "./storage.js";
import { uiElements } from "./ui-elements.js";
import { overpass } from "./overpass.js";
import constants from "./constants.js";
import publicKeys from "./public-keys.js";
import { haptic } from "./haptic.js";
import { forceMapUpdate, state } from "./main.js";

mapboxgl.accessToken = publicKeys.mapbox;
// Provide a minimal OSM raster style when the special option is selected
const OSM_RASTER_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
    },
  ],
};

export function resolveStyle(value) {
  if (value === "osm:raster") return OSM_RASTER_STYLE;
  return value;
}
export const map = new mapboxgl.Map({
  container: "map",
  style: resolveStyle(uiElements.mapStyle?.value),
  center: storage.latestLngLat,
  zoom: 10,
});

const addFeatureCollection = (id, color) => {
  map.addSource(id, {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [],
    },
  });
  map.addLayer({
    id: `${id}-line`,
    type: "line",
    source: id,
    layout: {
      "line-join": "round",
      "line-cap": "round",
    },
    minzoom: constants.TRAILS_MIN_ZOOM,
    paint: {
      "line-color": color,
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        constants.TRAILS_MIN_ZOOM,
        0.3,
        constants.TRAILS_MIN_ZOOM + 3,
        1.8,
      ],
      "line-dasharray": [2, 2],
    },
  });
  map.addLayer({
    id: `${id}-label`,
    type: "symbol",
    source: id,
    minzoom: constants.TRAILS_MIN_ZOOM,
    filter: ["has", "name"],
    layout: {
      "symbol-placement": "line",
      "text-field": ["get", "name"],
      "text-size": 11,
      "text-optional": true,
    },
    paint: {
      "text-color": "#ff0000", // red
      "text-halo-color": "#ffffff",
      "text-halo-width": 1,
    },
  });
};

const addRoutes = () => {
  if (!map.getSource("routes")) {
    map.addSource("routes", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });
  }
  if (!map.getLayer("routes-line")) {
    map.addLayer({
      id: `routes-line`,
      type: "line",
      source: "routes",
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      minzoom: 0,
      paint: {
        "line-color": ["coalesce", ["get", "color"], "#1d4ed8"],
        "line-width": 2,
      },
    });
  } else {
    // Ensure paint uses data-driven color if the layer already existed
    map.setPaintProperty("routes-line", "line-color", ["coalesce", ["get", "color"], "#1d4ed8"]);
    map.setPaintProperty("routes-line", "line-width", 2);
  }
  if (!map.getLayer("routes-label")) {
    map.addLayer({
      id: `routes-label`,
      type: "symbol",
      source: "routes",
      minzoom: constants.TRAILS_MIN_ZOOM,
      filter: ["has", "name"],
      layout: {
        "symbol-placement": "line",
        "text-field": ["get", "name"],
        "text-size": 11,
        "text-optional": true,
      },
      paint: {
        "text-color": "#ff0000", // red
        "text-halo-color": "#ffffff",
        "text-halo-width": 1,
      },
    });
  }
};

const ensureSectionPreview = () => {
  if (!map.getSource("section-preview")) {
    map.addSource("section-preview", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });
  }
  if (!map.getLayer("section-preview-line")) {
    map.addLayer({
      id: "section-preview-line",
      type: "line",
      source: "section-preview",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#ff0000",
        "line-width": 1.5,
        "line-opacity": 0.3,
      },
    });
  }
};

const ensureFeatureCollection = (id) => {
  const color = constants.COLLECTION_COLORS[id] || "#000000";
  if (!map.getSource(id)) {
    addFeatureCollection(id, color);
    return;
  }
  if (!map.getLayer(`${id}-line`)) {
    map.addLayer({
      id: `${id}-line`,
      type: "line",
      source: id,
      layout: { "line-join": "round", "line-cap": "round" },
      minzoom: constants.TRAILS_MIN_ZOOM,
      paint: {
        "line-color": color,
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          constants.TRAILS_MIN_ZOOM,
          0.3,
          constants.TRAILS_MIN_ZOOM + 3,
          1.5,
        ],
        "line-dasharray": [2, 2],
      },
    });
  }
  if (!map.getLayer(`${id}-label`)) {
    map.addLayer({
      id: `${id}-label`,
      type: "symbol",
      source: id,
      minzoom: constants.TRAILS_MIN_ZOOM,
      filter: ["has", "name"],
      layout: {
        "symbol-placement": "line",
        "text-field": ["get", "name"],
        "text-size": 11,
        "text-optional": true,
      },
      paint: {
        "text-color": "#ff0000",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1,
      },
    });
  }
};
const ensureTerrain = () => {
  map.setFog({});
  if (!map.getSource("mapbox-dem")) {
    map.addSource("mapbox-dem", {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
    });
  }
  map.setTerrain({ source: "mapbox-dem" });
};

const handleLoad = () => {
  ensureFeatureCollection("trails");
  ensureFeatureCollection("tracks");
  drawOverpassTrails();
  ensureTerrain();
  addRoutes();
  ensureSectionPreview();
};

map.on("load", () => {
  handleLoad();
  const firstPoint = state.routes[0]?.[0];
  if (firstPoint) {
    map.setCenter([firstPoint.lon, firstPoint.lat]);
    map.zoomTo(15);
    forceMapUpdate();
  } else {
    forceMapUpdate();
  }
});

map.on("style.load", () => {
  handleLoad();
});

export const setSectionPreviewData = (coordinates) => {
  let source = map.getSource("section-preview");
  if (!source) {
    ensureSectionPreview();
    source = map.getSource("section-preview");
    if (!source) return;
  }
  source.setData({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          id: "section-preview",
          tags: {},
          name: "Section Preview",
        },
        geometry: { type: "LineString", coordinates },
      },
    ],
  });
};

const setSourceData = (id) => {
  let source = map.getSource(id);
  if (!source) {
    ensureFeatureCollection(id);
    source = map.getSource(id);
    if (!source) return;
  }
  source.setData({
    type: "FeatureCollection",
    features: Object.values(storage[id]).map((item) => ({
      type: "Feature",
      properties: {
        id: item.id,
        tags: item.tags || {},
        name: item.tags?.["name"] || null,
      },
      geometry: {
        type: "LineString",
        coordinates: (item.geometry || []).map((pt) => [pt.lon, pt.lat]),
      },
    })),
  });
};

const randomHexColor = () => {
  return `#${Math.floor(Math.random() * 16777215).toString(16)}`;
};

export const setRoutesData = (routes) => {
  // Ensure routes source/layer exists (style changes can remove them)
  if (!map.getSource("routes") || !map.getLayer("routes-line")) {
    addRoutes();
  } else {
    // enforce paint in case of previous fixed color
    map.setPaintProperty("routes-line", "line-color", ["coalesce", ["get", "color"], "#1d4ed8"]);
  }
  const fc = {
    type: "FeatureCollection",
    features: (routes || []).map((route, i) => ({
      type: "Feature",
      properties: {
        color: constants.ROUTE_COLORS && constants.ROUTE_COLORS[i] ? constants.ROUTE_COLORS[i] : randomHexColor(),
      },
      geometry: {
        type: "LineString",
        coordinates: (route || [])
          .map((pt) => [Number(pt.lon), Number(pt.lat)])
          .filter((xy) => Number.isFinite(xy[0]) && Number.isFinite(xy[1])),
      },
    })),
  };
  console.log(routes);
  const src = map.getSource("routes");
  if (src) {
    src.setData(fc);
  }
};

const drawOverpassTrails = () => {
  setSourceData("trails");
  setSourceData("tracks");
};

const boundHasAlreadyBeenQueried = (bounds) => {
  return storage.queriedBounds.some((queriedBound) => {
    // Check if the current bounds are completely contained within any queried bound
    return (
      queriedBound._sw.lat <= bounds._sw.lat &&
      queriedBound._sw.lng <= bounds._sw.lng &&
      queriedBound._ne.lat >= bounds._ne.lat &&
      queriedBound._ne.lng >= bounds._ne.lng
    );
  });
};

map.on("moveend", () => {
  const center = map.getCenter();
  storage.latestLngLat = [center.lng, center.lat];
  const zoom = map.getZoom();
  if (zoom < constants.TRAILS_MIN_ZOOM) return;
  const bounds = map.getBounds();

  // Only query if this area hasn't been queried before
  if (boundHasAlreadyBeenQueried(bounds)) {
    console.log("Bounds already queried, skipping...");
    return;
  }
  console.log("Starting to query trails...");
  // expand the bounds by 50%
  const latDelta = bounds._ne.lat - bounds._sw.lat;
  const lngDelta = bounds._ne.lng - bounds._sw.lng;
  const expandedBounds = {
    _sw: {
      lat: bounds._sw.lat - latDelta * 0.5,
      lng: bounds._sw.lng - lngDelta * 0.5,
    },
    _ne: {
      lat: bounds._ne.lat + latDelta * 0.5,
      lng: bounds._ne.lng + lngDelta * 0.5,
    },
  };
  // clear cached trails, tracks, and queried bounds if the total memory is greater than 12MB
  if (getStateMemory().total > 12) {
    removeMemoryHogs();
  }

  storage.queriedBounds = [...storage.queriedBounds, expandedBounds];

  const bbox = `${expandedBounds._sw.lat},${expandedBounds._sw.lng},${expandedBounds._ne.lat},${expandedBounds._ne.lng}`;
  overpass
    .queryTrails(bbox)
    .then((data) => {
      const updatedTrails = { ...storage.trails };
      const updatedTracks = { ...storage.tracks };
      (data || []).forEach((element) => {
        if (element && element.type === "way" && Array.isArray(element.geometry)) {
          if (element.tags?.["highway"] === "track") {
            updatedTracks[element.id] = element;
          } else {
            updatedTrails[element.id] = element;
          }
        }
      });
      storage.trails = updatedTrails;
      storage.tracks = updatedTracks;
      drawOverpassTrails();
    })
    .catch((err) => {
      console.error(err);
    });
});
map.addControl(
  new mapboxgl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
    showUserHeading: true,
  }),
  "top-right"
);
map.addControl(
  new mapboxgl.NavigationControl({
    showCompass: true,
    showZoom: false, // optional
  }),
  "top-right"
);

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

export const setupStreetViewDrag = () => {
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
