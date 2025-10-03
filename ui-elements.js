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
  get streetviewPreview() {
    return /** @type {HTMLIFrameElement | null} */ (document.getElementById("streetview-preview"));
  },
  get deleteRouteButton() {
    return /** @type {HTMLButtonElement | null} */ (document.getElementById("delete-route"));
  },
  get reverseRouteButton() {
    return /** @type {HTMLButtonElement | null} */ (document.getElementById("reverse-route"));
  },
  get googleDocsOpenButton() {
    return /** @type {HTMLButtonElement | null} */ (document.getElementById("google-docs-open"));
  },
  get saveModal() {
    return /** @type {HTMLDialogElement | null} */ (document.getElementById("save-modal"));
  },
  get openSaveModalButton() {
    return /** @type {HTMLButtonElement | null} */ (document.getElementById("open-save-modal"));
  },
  get importModal() {
    return /** @type {HTMLDialogElement | null} */ (document.getElementById("import-modal"));
  },
  get importModalOpenButton() {
    return /** @type {HTMLButtonElement | null} */ (document.getElementById("import-modal-open"));
  },
  get saveFileButton() {
    return /** @type {HTMLButtonElement | null} */ (document.getElementById("save-file"));
  },
  get saveFileGoogleButton() {
    return /** @type {HTMLButtonElement | null} */ (document.getElementById("save-file-google"));
  },
  get saveToGoogleSuccessModal() {
    return /** @type {HTMLDialogElement | null} */ (document.getElementById("save-to-google-success-modal"));
  },
  get copyShareLinkButton() {
    return /** @type {HTMLButtonElement | null} */ (document.getElementById("copy-share-link"));
  },
  get shareLink() {
    return /** @type {HTMLSpanElement | null} */ (document.getElementById("share-link"));
  },
  get toggleElevationProfileButton() {
    return /** @type {HTMLButtonElement | null} */ (document.getElementById("toggle-elevation-profile"));
  },
  get elevationProfile() {
    return /** @type {HTMLDivElement | null} */ (document.getElementById("elevation-profile"));
  },
  get toolboxMore() {
    return /** @type {HTMLDetailsElement | null} */ (document.getElementById("toolbox-more"));
  },
};

// set the initial values to the storage values
uiElements.measurementSystem && (uiElements.measurementSystem.value = storage.measurementSystem)
uiElements.mapStyle && (uiElements.mapStyle.value = storage.mapStyle)
uiElements.mapStyle && (uiElements.mapStyle.value = storage.mapStyle)
