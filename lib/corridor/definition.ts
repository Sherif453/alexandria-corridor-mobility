type CorridorAnchor = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  source: string;
  sourceUrl: string;
};

export type CorridorSegmentDefinition = {
  segmentId: string;
  displayName: string;
  roadName: string;
  geometryRef: string;
  roadType: string;
  latitude: number;
  longitude: number;
  sortOrder: number;
};

const CORRIDOR_ROAD_TYPE = "urban-arterial";

export const CORRIDOR_ID = "alexandria-victoria-sidi-gaber-raml";
export const CORRIDOR_NAME =
  "Alexandria Corridor Mobility Intelligence Corridor";
export const CORRIDOR_SCOPE = "Victoria -> Sidi Gaber -> Raml (Mahattet El Raml)";
export const CORRIDOR_SAMPLE_POINT_COUNT = 35;
export const CORRIDOR_DEFINITION_VERSION = "2026-04-16.v6";

// Fixed points follow a documented corridor polyline across named localities on
// the Abu Qir / Al-Horreya axis, rather than a direct interpolation between
// only three anchors.
export const CORRIDOR_ROUTE_WAYPOINTS: readonly CorridorAnchor[] = [
  {
    id: "victoria-station",
    name: "Victoria Station",
    latitude: 31.24838,
    longitude: 29.97882,
    source: "Mapcarta / OpenStreetMap",
    sourceUrl: "https://mapcarta.com/13052536",
  },
  {
    id: "bakos",
    name: "Bakos",
    latitude: 31.23379,
    longitude: 29.9702,
    source: "Mapcarta / OpenStreetMap",
    sourceUrl: "https://mapcarta.com/W749734834",
  },
  {
    id: "saba-pasha",
    name: "Saba Pasha",
    latitude: 31.23695,
    longitude: 29.95597,
    source: "Mapcarta / GeoNames",
    sourceUrl: "https://mapcarta.com/30529722",
  },
  {
    id: "sidi-gaber-railway-station",
    name: "Sidi Gaber Railway Station",
    latitude: 31.219371,
    longitude: 29.942787,
    source: "Wikipedia / GeoHack",
    sourceUrl: "https://en.wikipedia.org/wiki/Sidi_Gaber_railway_station",
  },
  {
    id: "sporting-district",
    name: "Sporting District",
    latitude: 31.21732,
    longitude: 29.93305,
    source: "Mapcarta / GeoNames",
    sourceUrl: "https://mapcarta.com/30534664",
  },
  {
    id: "camp-cesar-district",
    name: "Camp Cesar District",
    latitude: 31.21276,
    longitude: 29.92049,
    source: "Mapcarta / GeoNames",
    sourceUrl: "https://mapcarta.com/30531376",
  },
  {
    id: "shatby",
    name: "Shatby",
    latitude: 31.2,
    longitude: 29.91667,
    source: "Mapcarta / OpenStreetMap",
    sourceUrl: "https://mapcarta.com/13065708",
  },
  {
    id: "el-raml-station",
    name: "El Raml Station",
    latitude: 31.199167,
    longitude: 29.901667,
    source: "Wikimapia",
    sourceUrl: "https://wikimapia.org/1708314/Raml-Station-Area-Downtown",
  },
] as const;

const CORRIDOR_SEGMENT_LOCALITIES = [
  "Victoria Station",
  "Luran Station",
  "Gnaklis Station",
  "Shots Station",
  "Safer Station",
  "Bakos",
  "Bakus Tram Stop",
  "Bakus",
  "Petroleum Hospital",
  "Fleming Station",
  "Gleem",
  "Saba Pasha",
  "Stanley",
  "Rushdi",
  "Mostafa Kamel Tombs",
  "Mostafa Kamel Hospital",
  "Sidi Gaber Station",
  "Sidi Gaber",
  "Cleopatra Station",
  "Cleopatra",
  "Sporting El-Kobra Station",
  "Sporting",
  "Al-Ibrahimia",
  "Ibrahimia",
  "Camp Caesar",
  "Camp Caesar District",
  "El Shatby Station",
  "College Saint-Marc",
  "Shatby",
  "Shatby",
  "Azarita Cemetery",
  "Al Khartoum Square",
  "Azarita District",
  "Raml Station Area",
  "Raml Station",
] as const;

if (CORRIDOR_SEGMENT_LOCALITIES.length !== CORRIDOR_SAMPLE_POINT_COUNT) {
  throw new Error("Corridor locality labels must match the sample point count.");
}

function distanceBetween(
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number },
) {
  const deltaLatitude = end.latitude - start.latitude;
  const deltaLongitude = end.longitude - start.longitude;

  return Math.sqrt(deltaLatitude ** 2 + deltaLongitude ** 2);
}

function interpolateAtDistance(
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number },
  progress: number,
) {
  return {
    latitude: Number(
      (start.latitude + (end.latitude - start.latitude) * progress).toFixed(6),
    ),
    longitude: Number(
      (start.longitude + (end.longitude - start.longitude) * progress).toFixed(6),
    ),
  };
}

function samplePolyline(
  waypoints: readonly CorridorAnchor[],
  totalPoints: number,
): { latitude: number; longitude: number }[] {
  if (waypoints.length < 2) {
    throw new Error("At least two waypoints are required.");
  }

  const legs = waypoints.slice(0, -1).map((waypoint, index) => {
    const nextWaypoint = waypoints[index + 1];
    const length = distanceBetween(waypoint, nextWaypoint);

    return {
      start: waypoint,
      end: nextWaypoint,
      length,
    };
  });

  const totalLength = legs.reduce((sum, leg) => sum + leg.length, 0);

  if (totalLength === 0) {
    return Array.from({ length: totalPoints }, () => ({
      latitude: waypoints[0].latitude,
      longitude: waypoints[0].longitude,
    }));
  }

  return Array.from({ length: totalPoints }, (_, index) => {
    const targetDistance =
      (totalLength * index) / Math.max(totalPoints - 1, 1);

    let traversed = 0;

    for (const leg of legs) {
      if (targetDistance <= traversed + leg.length) {
        const legProgress =
          leg.length === 0 ? 0 : (targetDistance - traversed) / leg.length;

        return interpolateAtDistance(leg.start, leg.end, legProgress);
      }

      traversed += leg.length;
    }

    const lastWaypoint = waypoints[waypoints.length - 1];

    return {
      latitude: Number(lastWaypoint.latitude.toFixed(6)),
      longitude: Number(lastWaypoint.longitude.toFixed(6)),
    };
  });
}

function toGeometryRef(latitude: number, longitude: number): string {
  return `POINT(${longitude.toFixed(6)} ${latitude.toFixed(6)})`;
}

function buildCorridorSegments(): CorridorSegmentDefinition[] {
  const orderedPoints = samplePolyline(
    CORRIDOR_ROUTE_WAYPOINTS,
    CORRIDOR_SAMPLE_POINT_COUNT,
  );

  return orderedPoints.map((point, index) => {
    const sortOrder = index + 1;

    return {
      segmentId: `alex-corridor-${String(sortOrder).padStart(2, "0")}`,
      displayName: CORRIDOR_SEGMENT_LOCALITIES[index],
      roadName: CORRIDOR_SEGMENT_LOCALITIES[index],
      geometryRef: toGeometryRef(point.latitude, point.longitude),
      roadType: CORRIDOR_ROAD_TYPE,
      latitude: point.latitude,
      longitude: point.longitude,
      sortOrder,
    };
  });
}

export const CORRIDOR_SEGMENTS = buildCorridorSegments();
