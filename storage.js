import constants from "./constants.js";

function openStateDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(constants.DB_NAME, constants.DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(constants.STORE_NAME)) {
        db.createObjectStore(constants.STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readState() {
  const db = await openStateDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(constants.STORE_NAME, "readonly");
    const store = tx.objectStore(constants.STORE_NAME);
    const getReq = store.get("root");
    getReq.onsuccess = () => {
      const value = getReq.result || {
        trails: {},
        tracks: {},
        queriedBounds: [],
        latestLngLat: constants.START_LNG_LAT,
        measurementSystem: constants.DEFAULT_MEASUREMENT_SYSTEM,
        mapStyle: constants.DEFAULT_MAP_STYLE,
        latestRoutes: [[]],
      };
      resolve(value);
    };
    getReq.onerror = () => reject(getReq.error);
    tx.oncomplete = () => db.close();
    tx.onabort = () => db.close();
  });
}

function writeState(state) {
  openStateDB()
    .then((db) => {
      const tx = db.transaction(constants.STORE_NAME, "readwrite");
      const store = tx.objectStore(constants.STORE_NAME);
      store.put(state, "root");
      tx.oncomplete = () => db.close();
      tx.onabort = () => db.close();
      tx.onerror = () => db.close();
    })
    .catch(() => {});
}

export function deleteDB() {
  console.log("Deleting DB...");
  const stuff = indexedDB.deleteDatabase(constants.DB_NAME);
  stuff.onsuccess = () => console.log("DB deleted");
  stuff.onerror = () => console.error("DB deletion failed");
}
window.deleteDB = deleteDB;

const initialState = await readState();
export const storage = new Proxy(initialState, {
  get(target, prop) {
    return target[prop];
  },
  set(target, prop, value) {
    target[prop] = value;
    writeState(target);
    return true;
  },
});

const fmtBytes = (n) => (n / 1024 ** 2)

const jsonBytes = (obj) => new TextEncoder().encode(JSON.stringify(obj)).length;

export const getStateMemory = () => {
  const trailsB = jsonBytes(storage.trails);
  const tracksB = jsonBytes(storage.tracks);
  const boundsB = jsonBytes(storage.queriedBounds);
  const totalB = trailsB + tracksB + boundsB;

  return {
    trails: fmtBytes(trailsB),
    tracks: fmtBytes(tracksB),
    queriedBounds: fmtBytes(boundsB),
    total: fmtBytes(totalB),
  };
};

export const removeMemoryHogs = () => {
  storage.trails = {};
  storage.tracks = {};
  storage.queriedBounds = [];
};