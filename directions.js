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
  if (state.straightLine) {
    const coordinates = [
      [startCoordinates.lon, startCoordinates.lat],
      [endCoordinates.lon, endCoordinates.lat],
    ];
    if (middleCoordinates) {
      coordinates.splice(1, 0, [middleCoordinates.lon, middleCoordinates.lat]);
    }
    // densify each segment with intermediate points ~every 100 meters, preserving order
    const spacingMeters = 100;
    const densified = [];
    for (let i = 0; i < coordinates.length - 1; i++) {
      const a = coordinates[i]; // [lon, lat]
      const b = coordinates[i + 1];
      densified.push(a);
      const segMeters = calculations.distance({ lon: a[0], lat: a[1] }, { lon: b[0], lat: b[1] });
      const steps = Math.floor(segMeters / spacingMeters);
      for (let s = 1; s < steps; s++) {
        const t = (s * spacingMeters) / segMeters;
        const lon = a[0] + t * (b[0] - a[0]);
        const lat = a[1] + t * (b[1] - a[1]);
        densified.push([lon, lat]);
      }
    }
    densified.push(coordinates[coordinates.length - 1]);
    coordinates.length = 0;
    coordinates.push(...densified);
    return {
      routes: [
        {
          geometry: {
            coordinates,
          },
        },
      ],
    };
  }
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