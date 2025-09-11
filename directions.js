import publicKeys from "./public-keys.js";
const getDirections = async (
  startCoordinates,
  endCoordinates,
  /** @type {{lon: number, lat: number} | null} */ middleCoordinates = null,
  profile = "mapbox/walking"
) => {
  let coordinates = `${startCoordinates.lon},${startCoordinates.lat};${endCoordinates.lon},${endCoordinates.lat}`;

  if (middleCoordinates) {
    const middle = /** @type {{lon: number, lat: number}} */ (middleCoordinates);
    coordinates = `${startCoordinates.lon},${startCoordinates.lat};${middle.lon},${middle.lat};${endCoordinates.lon},${endCoordinates.lat}`;
  }

  const options = `?overview=full&geometries=geojson&access_token=${publicKeys.mapbox}`;
  const url = `https://api.mapbox.com/directions/v5/${profile}/${coordinates}${options}`;
  const response = await fetch(url);
  const data = await response.json();
  return data;
};

export default getDirections;