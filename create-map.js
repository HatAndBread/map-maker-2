import { storage, getStateMemory, removeMemoryHogs } from "./storage.js";
import { uiElements } from "./ui-elements.js";
import { overpass } from "./overpass.js";
import constants from "./constants.js";
import publicKeys from "./public-keys.js";

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
  if (!map.getSource("mapbox-dem")) {
    map.addSource("mapbox-dem", {
      type: "raster-dem",
      url: "mapbox://mapbox.terrain-rgb",
      tileSize: 512,
      maxzoom: 14,
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
};

map.on("load", () => {
  handleLoad();
});

map.on("style.load", () => {
  handleLoad();
});

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
