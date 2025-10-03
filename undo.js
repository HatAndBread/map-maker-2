import { uiElements } from "./ui-elements.js";
import { undoManager } from "./main.js";
export class Undo {
  constructor() {
    this.undos = [];
    this.redos = [];
    this.updateButtons();
  }

  _validateAction(action) {
    if (typeof action?.undo !== "function") {
      throw new Error("Undo action must have an undo function");
    }
    if (typeof action?.redo !== "function") {
      throw new Error("Undo action must have an redo function");
    }
  }

  updateButtons() {
    if (this.undos.length === 0 && uiElements.undoButton) {
      uiElements.undoButton.disabled = true;
    }
    if (this.redos.length === 0 && uiElements.redoButton) {
      uiElements.redoButton.disabled = true;
    }
    if (this.undos.length > 0 && uiElements.undoButton) {
      uiElements.undoButton.disabled = false;
    }
    if (this.redos.length > 0 && uiElements.redoButton) {
      uiElements.redoButton.disabled = false;
    }
  }

  add(action) {
    this._validateAction(action);
    this.undos.push(action);
    action.redo();
    this.updateButtons();
  }

  undo() {
    const undo = this.undos.pop();
    if (!undo) return;
    undo.undo();
    this.redos.push(undo);
    this.updateButtons();
  }

  redo() {
    const redo = this.redos.pop();
    if (!redo) return;
    redo.redo();
    this.undos.push(redo);
    this.updateButtons();
  }
}

let keysDown = new Set();

document.addEventListener("keydown", (e) => {
  keysDown.add(e.key);
  const modifierDown = e.metaKey || e.ctrlKey; // Cmd on macOS, Ctrl on Windows/Linux
  if (!modifierDown) return;
  const key = e.key.toLowerCase();
  if (key === "z") {
    e.preventDefault();
    if (e.shiftKey) {
      // Shift+Cmd/Ctrl+Z → redo
      undoManager.redo();
    } else {
      // Cmd/Ctrl+Z → undo
      undoManager.undo();
    }
  } else if (key === "y") {
    // Cmd/Ctrl+Y → redo (Windows/Linux convention)
    e.preventDefault();
    undoManager.redo();
  } else if (key === "e") {
    e.preventDefault();
    uiElements.toggleElevationProfileButton?.click();
  } else if (key === "s") {
    e.preventDefault();
    uiElements.openSaveModalButton?.click();
  } else if (key === "o") {
    e.preventDefault();
    uiElements.importModalOpenButton?.click();
  } else if (key === "d") {
    e.preventDefault();
    uiElements.deleteRouteButton?.click();
  } else if (key === "r") {
    e.preventDefault();
    uiElements.reverseRouteButton?.click();
  }
});

document.addEventListener("keyup", (e) => keysDown.delete(e.key));

// Desktop-only tooltips for keyboard shortcuts
(() => {
  const isTouch = "ontouchstart" in window || (navigator && (navigator.maxTouchPoints || 0) > 0);
  if (isTouch) return;
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  const isMac = /Mac|iPhone|iPad|iPod/i.test(ua);
  const mod = isMac ? "⌘" : "Ctrl+";
  const redoHint = isMac ? "Shift+⌘Z" : "Ctrl+Y";
  uiElements.undoButton && (uiElements.undoButton.title = `Undo (${mod}Z)`);
  uiElements.redoButton && (uiElements.redoButton.title = `Redo (${redoHint})`);
  uiElements.toggleElevationProfileButton &&
    (uiElements.toggleElevationProfileButton.title = `Toggle elevation profile (${mod}E)`);
  uiElements.openSaveModalButton && (uiElements.openSaveModalButton.title = `Save (${mod}S)`);
  uiElements.importModalOpenButton && (uiElements.importModalOpenButton.title = `Import (${mod}O)`);
  uiElements.deleteRouteButton && (uiElements.deleteRouteButton.title = `Clear route (${mod}D)`);
  uiElements.reverseRouteButton && (uiElements.reverseRouteButton.title = `Reverse route (${mod}R)`);
})();
