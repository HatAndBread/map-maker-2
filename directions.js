import publicKeys from "./public-keys.js";
const getDirections = async (startCoordinates, endCoordinates, profile = "mapbox/walking") => {
    const options = `?overview=full&geometries=geojson&access_token=${publicKeys.mapbox}`
    const url = `https://api.mapbox.com/directions/v5/${profile}/${startCoordinates.lon},${startCoordinates.lat};${endCoordinates.lon},${endCoordinates.lat}${options}`;
    const response = await fetch(url);
    const data = await response.json();
    return data;
};

export default getDirections;