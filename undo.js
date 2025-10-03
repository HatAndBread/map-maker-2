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
  if (keysDown.has("Meta") && e.key === "z") {
    e.preventDefault();
    undoManager.undo();
  } else if (keysDown.has("Meta") && e.key === "y") {
    e.preventDefault();
    undoManager.redo();
  }
});

document.addEventListener("keyup", (e) => keysDown.delete(e.key));