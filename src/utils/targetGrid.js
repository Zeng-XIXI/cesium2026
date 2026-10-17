import { Cartographic, GeographicTilingScheme } from "cesium";

const tilingScheme = new GeographicTilingScheme();

const heightLevels = [
  { minHeight: 8_000_000, level: 2 },
  { minHeight: 7_000_000, level: 3 },
  { minHeight: 6_000_000, level: 4 },
  { minHeight: 5_000_000, level: 5 },
  { minHeight: 4_000_000, level: 6 },
  { minHeight: 3_000_000, level: 7 },
  { minHeight: 1_000_000, level: 8 },
  { minHeight: 300_000, level: 9 },
  { minHeight: 100_000, level: 10 },
];

export function getGridLevelByHeight(height) {
  return (
    heightLevels.find((item) => height >= item.minHeight)?.level ?? null
  );
}

export function aggregateTargetsByGrid(targets, level) {
  if (level === null) {
    return targets.map((target) => ({
      ...target,
      count: 1,
      isCluster: false,
    }));
  }

  const groups = new Map();

  targets.forEach((target) => {
    const tile = tilingScheme.positionToTileXY(
      Cartographic.fromDegrees(target.longitude, target.latitude),
      level,
    );
    const key = `${target.categoryId}:${tile.x}:${tile.y}`;

    if (!groups.has(key)) {
      groups.set(key, { tile, targets: [] });
    }
    groups.get(key).targets.push(target);
  });

  return [...groups.values()].map(({ tile, targets: gridTargets }) => {
    if (gridTargets.length === 1) {
      return {
        ...gridTargets[0],
        count: 1,
        isCluster: false,
      };
    }

    const first = gridTargets[0];
    const count = gridTargets.length;
    const sum = gridTargets.reduce(
      (result, target) => ({
        longitude: result.longitude + target.longitude,
        latitude: result.latitude + target.latitude,
        altitude: result.altitude + target.altitude,
      }),
      { longitude: 0, latitude: 0, altitude: 0 },
    );

    return {
      id: `grid-${level}-${first.categoryId}-${tile.x}-${tile.y}`,
      name: `${first.categoryName}聚合点`,
      categoryId: first.categoryId,
      categoryName: first.categoryName,
      longitude: sum.longitude / count,
      latitude: sum.latitude / count,
      altitude: sum.altitude / count,
      description: `该网格内包含 ${count} 个${first.categoryName}目标`,
      color: first.color,
      count,
      isCluster: true,
      gridLevel: level,
    };
  });
}
