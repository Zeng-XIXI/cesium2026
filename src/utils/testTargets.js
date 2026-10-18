function randomBetween(min, max) {
  return Number((min + Math.random() * (max - min)).toFixed(6));
}

function createTargetId(usedIds) {
  let id;
  do {
    const suffix =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    id = `test-${suffix}`;
  } while (usedIds.has(id));
  usedIds.add(id);
  return id;
}

export function createTestTargets({
  count,
  categoryId,
  categoryName,
  longitudeMin,
  longitudeMax,
  latitudeMin,
  latitudeMax,
  color,
  existingIds = [],
}) {
  const usedIds = new Set(existingIds);

  return Array.from({ length: count }, (_, index) => ({
    id: createTargetId(usedIds),
    name: `测试数据${index + 1}`,
    categoryId,
    categoryName,
    longitude: randomBetween(longitudeMin, longitudeMax),
    latitude: randomBetween(latitudeMin, latitudeMax),
    altitude: 0,
    description: "前端生成的测试数据",
    color,
  }));
}
