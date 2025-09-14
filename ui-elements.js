import { deleteDB, storage } from "./storage.js"
import { map, resolveStyle } from "./create-map.js"
export const uiElements = {
  get measurementSystem() {
    return /** @type {HTMLSelectElement | null} */ (document.getElementById("measurement-system"));
  },
  get deleteDBButton() {
    return document.getElementById("delete-db");
  },
  get mapStyle() {
    return /** @type {HTMLSelectElement | null} */ (document.getElementById("map-style"));
  },
  get map() {
    return document.getElementById("map");
  },
  get elevationValue() {
    return document.getElementById("elevation-value");
  },
  get pointerLng() {
    return document.getElementById("pointer-lng");
  },
  get pointerLat() {
    return document.getElementById("pointer-lat");
  },
  get streetViewIcon() {
    return document.getElementById("street-view-icon");
  },
  get gpxInput() {
    return /** @type {HTMLInputElement | null} */ (document.getElementById("gpx-input"));
  },
  get undoButton() {
    return /** @type {HTMLButtonElement | null} */ (document.getElementById("undo"));
  },
  get redoButton() {
    return /** @type {HTMLButtonElement | null} */ (document.getElementById("redo"));
  },
  get straightLine() {
    return /** @type {HTMLInputElement | null} */ (document.getElementById("straight-line"));
  },
  get mapboxProfile() {
    return /** @type {HTMLSelectElement | null} */ (document.getElementById("mapbox-profile"));
  },
  get distanceValue() {
    return /** @type {HTMLSpanElement | null} */ (document.getElementById("distance-value"));
  },
  get distance3dValue() {
    return /** @type {HTMLSpanElement | null} */ (document.getElementById("distance-3d-value"));
  },
  get fileNameInput() {
    return /** @type {HTMLInputElement | null} */ (document.getElementById("file-name-input"));
  },
  get saveFileButton() {
    return /** @type {HTMLButtonElement | null} */ (document.getElementById("save-file"));
  },
  get streetviewPreview() {
    return /** @type {HTMLIFrameElement | null} */ (document.getElementById("streetview-preview"));
  },
  get newRouteButton() {
    return /** @type {HTMLButtonElement | null} */ (document.getElementById("new-route"));
  },
  get deleteRouteButton() {
    return /** @type {HTMLButtonElement | null} */ (document.getElementById("delete-route"));
  },
  get currentRouteSelect() {
    return /** @type {HTMLSelectElement | null} */ (document.getElementById("current-route-select"));
  },
};

// set the initial values to the storage values
uiElements.measurementSystem && (uiElements.measurementSystem.value = storage.measurementSystem)
uiElements.mapStyle && (uiElements.mapStyle.value = storage.mapStyle)
uiElements.mapStyle && (uiElements.mapStyle.value = storage.mapStyle)
