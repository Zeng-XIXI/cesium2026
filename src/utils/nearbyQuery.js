const EARTH_RADIUS_KM = 6371.0088;
export const SPATIAL_HASH_CELL_KM = 50;
const CELL_DEGREES = SPATIAL_HASH_CELL_KM / 111.32;

export function distanceKm(longitudeA, latitudeA, longitudeB, latitudeB) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const latitudeARadians = toRadians(latitudeA);
  const latitudeBRadians = toRadians(latitudeB);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeARadians) *
      Math.cos(latitudeBRadians) *
      Math.sin(longitudeDelta / 2) ** 2;
  return (
    2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function getCellKey(longitude, latitude) {
  const x = Math.floor((longitude + 180) / CELL_DEGREES);
  const y = Math.floor((latitude + 90) / CELL_DEGREES);
  return `${x}:${y}`;
}

function getCellCoordinates(longitude, latitude) {
  return {
    x: Math.floor((longitude + 180) / CELL_DEGREES),
    y: Math.floor((latitude + 90) / CELL_DEGREES),
  };
}

function getDistanceRows(targets, longitude, latitude) {
  return targets.map((target) => ({
    ...target,
    distanceKm: distanceKm(
      longitude,
      latitude,
      target.longitude,
      target.latitude,
    ),
  }));
}

function formatResult(rows, queryType, limit) {
  const sorted = rows.sort((a, b) => a.distanceKm - b.distanceKm);
  return queryType === "nearest" ? sorted.slice(0, limit) : sorted;
}

export function buildSpatialHash(targets) {
  const cells = new Map();
  targets.forEach((target) => {
    const key = getCellKey(target.longitude, target.latitude);
    const cell = cells.get(key) || [];
    cell.push(target);
    cells.set(key, cell);
  });
  return cells;
}

function getNearbyCells(cells, longitude, latitude, radiusKm) {
  const center = getCellCoordinates(longitude, latitude);
  const latitudeRange = Math.ceil(radiusKm / SPATIAL_HASH_CELL_KM) + 1;
  const longitudeRange = Math.ceil(
    radiusKm /
      (SPATIAL_HASH_CELL_KM * Math.max(Math.cos((latitude * Math.PI) / 180), 0.2)),
  ) + 1;
  const candidates = [];
  let scannedCells = 0;

  for (let y = center.y - latitudeRange; y <= center.y + latitudeRange; y += 1) {
    for (
      let x = center.x - longitudeRange;
      x <= center.x + longitudeRange;
      x += 1
    ) {
      scannedCells += 1;
      const cell = cells.get(`${x}:${y}`);
      if (cell) {
        candidates.push(...cell);
      }
    }
  }

  return { candidates, scannedCells };
}

function getNearestCells(cells, longitude, latitude, limit) {
  const center = getCellCoordinates(longitude, latitude);
  const candidates = [];
  const visited = new Set();
  const occupiedKeys = [...cells.keys()];
  let scannedCells = 0;
  const maxRing = Math.ceil(180 / CELL_DEGREES) + Math.ceil(90 / CELL_DEGREES);

  for (let ring = 0; ring <= maxRing; ring += 1) {
    for (let y = center.y - ring; y <= center.y + ring; y += 1) {
      for (let x = center.x - ring; x <= center.x + ring; x += 1) {
        if (Math.max(Math.abs(x - center.x), Math.abs(y - center.y)) !== ring) {
          continue;
        }
        const key = `${x}:${y}`;
        if (visited.has(key)) {
          continue;
        }
        visited.add(key);
        scannedCells += 1;
        const cell = cells.get(key);
        if (cell) {
          candidates.push(...cell);
        }
      }
    }

    const allOccupiedCellsVisited = occupiedKeys.every((key) => visited.has(key));
    if (candidates.length >= limit || allOccupiedCellsVisited) {
      break;
    }
  }

  return { candidates, scannedCells };
}

export function queryNearestByFullScan(targets, point, limit) {
  const rows = getDistanceRows(targets, point.longitude, point.latitude);
  return {
    rows: formatResult(rows, "nearest", limit),
    scannedCells: targets.length,
    candidateCount: targets.length,
  };
}

export function queryWithinByFullScan(targets, point, radiusKm) {
  const rows = getDistanceRows(targets, point.longitude, point.latitude).filter(
    (target) => target.distanceKm <= radiusKm,
  );
  return {
    rows: formatResult(rows, "within"),
    scannedCells: targets.length,
    candidateCount: targets.length,
  };
}

export function queryNearestBySpatialHash(targets, point, limit, spatialHash) {
  const cells = spatialHash || buildSpatialHash(targets);
  const { candidates, scannedCells } = getNearestCells(
    cells,
    point.longitude,
    point.latitude,
    limit,
  );
  const rows = getDistanceRows(candidates, point.longitude, point.latitude);
  return {
    rows: formatResult(rows, "nearest", limit),
    scannedCells,
    candidateCount: candidates.length,
  };
}

export function queryWithinBySpatialHash(targets, point, radiusKm, spatialHash) {
  const cells = spatialHash || buildSpatialHash(targets);
  const { candidates, scannedCells } = getNearbyCells(
    cells,
    point.longitude,
    point.latitude,
    radiusKm,
  );
  const rows = getDistanceRows(candidates, point.longitude, point.latitude).filter(
    (target) => target.distanceKm <= radiusKm,
  );
  return {
    rows: formatResult(rows, "within"),
    scannedCells,
    candidateCount: candidates.length,
  };
}

export function queryNearbyTargets(targets, options) {
  const startedAt = performance.now();
  const useSpatialHash = options.method === "spatial-hash";
  const result =
    options.queryType === "nearest"
      ? useSpatialHash
        ? queryNearestBySpatialHash(
            targets,
            options.point,
            options.limit,
            options.spatialHash,
          )
        : queryNearestByFullScan(targets, options.point, options.limit)
      : useSpatialHash
        ? queryWithinBySpatialHash(
            targets,
            options.point,
            options.radiusKm,
            options.spatialHash,
          )
        : queryWithinByFullScan(targets, options.point, options.radiusKm);

  return {
    ...result,
    elapsedMs: Number((performance.now() - startedAt).toFixed(2)),
  };
}
