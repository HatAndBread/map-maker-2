import { deleteDB, storage } from "./storage.js"
import { map, resolveStyle } from "./create-map.js"
export const uiElements = {
  get measurementSystem() {
    return /** @type {HTMLSelectElement | null} */ (document.getElementById("measurement-system"))
  },
  get deleteDBButton() {
    return document.getElementById("delete-db")
  },
  get mapStyle() {
    return /** @type {HTMLSelectElement | null} */ (document.getElementById("map-style"))
  },
  get map() {
    return document.getElementById("map")
  },
  get elevationValue() {
    return document.getElementById("elevation-value")
  },
  get pointerLng() {
    return document.getElementById("pointer-lng")
  },
  get pointerLat() {
    return document.getElementById("pointer-lat")
  },
  get streetViewIcon() {
    return document.getElementById("street-view-icon")
  },
  get gpxInput() {
    return /** @type {HTMLInputElement | null} */ (document.getElementById("gpx-input"))
  },
  get undoButton() {
    return /** @type {HTMLButtonElement | null} */ (document.getElementById("undo"))
  },
  get redoButton() {
    return /** @type {HTMLButtonElement | null} */ (document.getElementById("redo"))
  },
}

// set the initial values to the storage values
uiElements.measurementSystem && (uiElements.measurementSystem.value = storage.measurementSystem)
uiElements.mapStyle && (uiElements.mapStyle.value = storage.mapStyle)
uiElements.mapStyle && (uiElements.mapStyle.value = storage.mapStyle)
