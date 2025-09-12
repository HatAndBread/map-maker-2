import publicKeys from "./public-keys.js";
import { state } from "./main.js";
import calculations from "./calcuations.js";

export const MAPBOX_PROFILES = [
  "mapbox/walking",
  "mapbox/cycling",
  "mapbox/driving",
  "mapbox/driving-traffic",
  "mapbox/driving-traffic",
];
const getDirections = async (
  startCoordinates,
  endCoordinates,
  /** @type {{lon: number, lat: number} | null} */ middleCoordinates = null
) => {
  let coordinates = `${startCoordinates.lon},${startCoordinates.lat};${endCoordinates.lon},${endCoordinates.lat}`;

  if (middleCoordinates) {
    const middle = /** @type {{lon: number, lat: number}} */ (middleCoordinates);
    coordinates = `${startCoordinates.lon},${startCoordinates.lat};${middle.lon},${middle.lat};${endCoordinates.lon},${endCoordinates.lat}`;
  }

  const options = `?overview=full&geometries=geojson&access_token=${publicKeys.mapbox}`;
  const url = `https://api.mapbox.com/directions/v5/${state.mapboxProfile}/${coordinates}${options}`;
  const response = await fetch(url);
  const data = await response.json();
  let result = data.routes?.[0]?.geometry?.coordinates;
  // insert elevation
  if (result) {
    for (let i = 0; i < result.length; i++) {
      const elevation = calculations.elevation(result[i][0], result[i][1]);
      result[i] = [result[i][0], result[i][1], elevation];
    }
  }

  return data;
};


export default getDirections;