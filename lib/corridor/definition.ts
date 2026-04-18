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
export const CORRIDOR_DEFINITION_VERSION = "2026-04-18.v7";

// Fixed monitored points are sampled from the OSM/OSRM drivable route whose
// main mapped spine is `شارع جمال عبد الناصر` / `Gamal Abd Al Naser Street`
// from Victoria toward Raml. The final western connector keeps the PDF-required
// Raml endpoint even though the named OSM way ends east of Mahattet El Raml.
const CORRIDOR_SEGMENT_LOCALITIES = [
  "Victoria",
  "Victoria College",
  "Louran",
  "Gnaklis",
  "Bakos",
  "Notre Dame de Sion",
  "Fleming",
  "Petroleum Hospital",
  "Fleming Station",
  "Raml Police Station",
  "Saba Pasha",
  "Gleem",
  "Stanley",
  "Rushdi",
  "Mostafa Kamel Tombs",
  "Mostafa Kamel Hospital",
  "Sidi Gaber Station",
  "Sidi Gaber",
  "Cleopatra Station",
  "Cleopatra",
  "Sporting El-Kobra",
  "Sporting",
  "Al-Ibrahimia",
  "Ibrahimia",
  "Camp Caesar",
  "Camp Caesar Bridge",
  "El Shatby Station",
  "College Saint-Marc",
  "Shatby",
  "Shatby Hospital",
  "Azarita Cemetery",
  "Al Khartoum Square",
  "Azarita District",
  "Raml Station Area",
  "Raml Station",
] as const;

const CORRIDOR_ROUTE_POINTS = [
  { latitude: 31.249492, longitude: 29.980524 },
  { latitude: 31.247722, longitude: 29.978375 },
  { latitude: 31.246394, longitude: 29.975788 },
  { latitude: 31.245286, longitude: 29.973053 },
  { latitude: 31.243804, longitude: 29.97058 },
  { latitude: 31.242168, longitude: 29.968235 },
  { latitude: 31.240563, longitude: 29.965877 },
  { latitude: 31.239053, longitude: 29.963433 },
  { latitude: 31.237192, longitude: 29.961377 },
  { latitude: 31.235151, longitude: 29.959519 },
  { latitude: 31.233142, longitude: 29.957612 },
  { latitude: 31.231153, longitude: 29.955679 },
  { latitude: 31.229284, longitude: 29.953588 },
  { latitude: 31.227602, longitude: 29.951298 },
  { latitude: 31.226056, longitude: 29.948872 },
  { latitude: 31.224295, longitude: 29.946692 },
  { latitude: 31.222265, longitude: 29.944823 },
  { latitude: 31.220362, longitude: 29.942774 },
  { latitude: 31.218476, longitude: 29.940703 },
  { latitude: 31.216619, longitude: 29.938596 },
  { latitude: 31.2147, longitude: 29.936567 },
  { latitude: 31.212777, longitude: 29.934542 },
  { latitude: 31.210853, longitude: 29.932519 },
  { latitude: 31.20894, longitude: 29.930483 },
  { latitude: 31.207199, longitude: 29.92827 },
  { latitude: 31.205806, longitude: 29.925728 },
  { latitude: 31.204687, longitude: 29.923 },
  { latitude: 31.203586, longitude: 29.920263 },
  { latitude: 31.202521, longitude: 29.917506 },
  { latitude: 31.201528, longitude: 29.914745 },
  { latitude: 31.202444, longitude: 29.912113 },
  { latitude: 31.201813, longitude: 29.90918 },
  { latitude: 31.200548, longitude: 29.906542 },
  { latitude: 31.199352, longitude: 29.903883 },
  { latitude: 31.199001, longitude: 29.901358 },
] as const;

if (
  CORRIDOR_SEGMENT_LOCALITIES.length !== CORRIDOR_SAMPLE_POINT_COUNT ||
  CORRIDOR_ROUTE_POINTS.length !== CORRIDOR_SAMPLE_POINT_COUNT
) {
  throw new Error("Corridor labels and points must match the sample point count.");
}

function toGeometryRef(latitude: number, longitude: number): string {
  return `POINT(${longitude.toFixed(6)} ${latitude.toFixed(6)})`;
}

function buildCorridorSegments(): CorridorSegmentDefinition[] {
  return CORRIDOR_ROUTE_POINTS.map((point, index) => {
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
