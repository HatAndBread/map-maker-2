import { parseGpx, routeToGpx } from "./gpx.js";
import { state, forceMapUpdate } from "./main.js";
import { storage } from "./storage.js";
import publicKeys from "./public-keys.js";
import { undoManager } from "./main.js";
import { map } from "./create-map.js";
import { uiElements } from "./ui-elements.js";

let pickerAccessToken = null;
let driveAccessToken = null;

// Open the success dialog robustly on mobile after OAuth flows
function openSaveToGoogleSuccessModalSafely(shareUrl) {
  const dialog = uiElements.saveToGoogleSuccessModal;
  if (!dialog) return;

  // Ensure other dialogs are closed to avoid conflicts
  uiElements.saveModal?.close();
  uiElements.importModal?.close();

  const attemptOpen = () => {
    try {
      if (typeof HTMLDialogElement === "undefined" || !("showModal" in dialog)) {
        dialog.show?.();
      } else {
        dialog.showModal();
      }
    } catch (e) {
      // Fallbacks if showModal isn't allowed in current state
      if (dialog.show) {
        try {
          dialog.show();
          return;
        } catch {}
      }
      alert(`File saved. Share: ${shareUrl}`);
    }
  };

  const openWhenActive = () => {
    // Yield to next frame to let focus/activation settle on mobile Safari
    requestAnimationFrame(() => setTimeout(attemptOpen, 0));
  };

  if (document.visibilityState !== "visible" || !document.hasFocus()) {
    let opened = false;
    const tryOpen = () => {
      if (opened) return;
      if (document.visibilityState === "visible" && document.hasFocus()) {
        opened = true;
        window.removeEventListener("focus", tryOpen);
        document.removeEventListener("visibilitychange", tryOpen);
        openWhenActive();
      }
    };
    window.addEventListener("focus", tryOpen, { once: true });
    document.addEventListener("visibilitychange", tryOpen, { once: true });
    // Last-resort timeout in case focus event is swallowed
    setTimeout(() => {
      if (!opened && document.visibilityState === "visible") {
        opened = true;
        window.removeEventListener("focus", tryOpen);
        document.removeEventListener("visibilitychange", tryOpen);
        openWhenActive();
      }
    }, 1500);
    return;
  }

  openWhenActive();
}

const authorize = (cb, isPicker) => {
  const token = isPicker ? pickerAccessToken : driveAccessToken;
  const scope = isPicker
    ? "https://www.googleapis.com/auth/drive.readonly"
    : "https://www.googleapis.com/auth/drive.file";
  if (!token) {
    // Request access token
    google.accounts.oauth2
      .initTokenClient({
        client_id: publicKeys.googleClient,
        scope: scope,
        callback: (tokenResponse) => {
          if (isPicker) {
            pickerAccessToken = tokenResponse.access_token;
          } else {
            driveAccessToken = tokenResponse.access_token;
          }
          cb();
        },
      })
      .requestAccessToken();
  } else {
    cb();
  }
};

async function createGoogleDoc() {
  const content = routeToGpx(state.routes[state.currentEditingRoute]);

  const metadata = {
    name: state.filename ? `${state.filename}.gpx` : "map-maker-2.gpx",
    mimeType: "application/gpx+xml",
  };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([content], { type: "application/gpx+xml" }));

  try {
    const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: { Authorization: `Bearer ${driveAccessToken}` },
      body: form,
    });
    const data = await res.json();
    console.log("File created:", data);
    storage.savedGoogleDocs.push(data);
    // Attempt to set the file public so it can be fetched by key if desired
    try {
      await makePublic(data.id);
    } catch (e) {
      console.warn("makePublic failed", e);
    }
    const shareUrl = `${window.location.origin}?id=${data.id}`;
    if (uiElements.shareLink) uiElements.shareLink.textContent = shareUrl;
    openSaveToGoogleSuccessModalSafely(shareUrl);
  } catch (err) {
    driveAccessToken = null;
    console.error(err);
  }
}

export async function authenticateAndCreateGoogleDoc() {
  authorize(createGoogleDoc, false);
}

// Make a Drive file readable by anyone with the link
export async function makePublic(fileId) {
  if (!fileId) throw new Error("Missing fileId");
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
    fileId
  )}/permissions?supportsAllDrives=true`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${driveAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "anyone", role: "reader", allowFileDiscovery: false }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Download a GPX file from Google Drive by fileId and load it into the app
export async function openGpxFromDrive({ id, name }) {
  if (!id) throw new Error("Missing Google Drive fileId");
  // Ensure we have an access token first
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${pickerAccessToken}` } });
  if (!res.ok) throw new Error(await res.text());
  const gpx = await res.text();
  const routes = parseGpx(gpx);
  if (Array.isArray(routes)) {
    const editingRoute = state.currentEditingRoute;
    const routesCopy = state.routes.map((route) => [...route]);
    const currentName = state.filename;
    const redo = () => {
      state.routes = routes;
      state.currentEditingRoute = 0;
      state.filename = name;
      const bounds = routes.map((route) => route.map((point) => ({ lng: point.lon, lat: point.lat })));
      const r = bounds[0] || [];
      const lngLatBounds = new mapboxgl.LngLatBounds(r[0], r[0]);
      for (let i = 1; i < r.length; i++) {
        lngLatBounds.extend(r[i]);
      }
      map.fitBounds(lngLatBounds);
      forceMapUpdate();
    };
    const undo = () => {
      state.routes = routesCopy;
      state.currentEditingRoute = editingRoute;
      state.filename = currentName;
      forceMapUpdate();
    };
    undoManager.add({ undo, redo });
  }
  return routes;
}

// Open Google's Drive Picker to choose a GPX and load it
export function pickGpxFromDrive() {
  return new Promise((resolve, reject) => {
    authorize(() => {
      try {
        gapi.load("picker", () => {
          const mimeTypes = "application/gpx+xml,application/xml,text/xml,application/octet-stream";

          const recent = new google.picker.DocsView(google.picker.ViewId.RECENT)
            .setIncludeFolders(false)
            .setMode(google.picker.DocsViewMode.LIST)
            .setMimeTypes(mimeTypes);

          const picker = new google.picker.PickerBuilder()
            .setDeveloperKey(publicKeys.google)
            .setOAuthToken(pickerAccessToken)
            .addView(recent)
            .setInitialView(recent)
            .setCallback((data) => {
              if (data.action === google.picker.Action.PICKED) {
                const doc = data.docs && data.docs[0];
                const name = doc && doc.name.split(".")[0];
                if (doc && doc.id) return resolve({ id: doc.id, name });
                return reject(new Error("No file selected"));
              }
              if (data.action === google.picker.Action.CANCEL) {
                return reject(new Error("Picker canceled"));
              }
            })
            .build();
          picker.setVisible(true);
        });
      } catch (e) {
        pickerAccessToken = null;
        reject(e);
      }
    }, true);
  });
}

export async function pickAndOpenGpx() {
  const { id, name } = await pickGpxFromDrive();
  return openGpxFromDrive({ id, name });
}

export async function getFileById(fileId) {
  fileId = encodeURIComponent(fileId);
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${publicKeys.google}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Download failed");
  const text = await res.text();
  return text;
}
