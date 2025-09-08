export const overpass = {
  index: 0,
  endpoints: [
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
  ],
  get endpoint() {
    const index = this.index
    this.index = (this.index + 1) % this.endpoints.length
    return this.endpoints[index]
  },
  async query(query) {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ data: query }).toString(),
    })
    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status} ${response.statusText}`)
    }
    const data = await response.json()
    return data
  },
  async queryTrails(bbox) {
    const query = `
[out:json][timeout:25];
(
  way["highway"="path"](${bbox});
  way["highway"="track"](${bbox});
  way["highway"="steps"](${bbox});
  way["highway"="footway"](${bbox});
);
out geom;
`
    const result = await this.query(query)
    return result.elements
  },
}