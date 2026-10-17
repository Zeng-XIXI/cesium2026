// 用于构造随机目标数据的函数
function generateRandomTargets(
  categoryName,
  count,
  color,
  longitudeRange,
  latitudeRange,
  categoryId = categoryName
) {
  if (!categoryName || typeof categoryName !== "string") {
    throw new Error("categoryName 必须是非空字符串");
  }

  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("count 必须是大于 0 的整数");
  }

  const [minLongitude, maxLongitude] = longitudeRange;
  const [minLatitude, maxLatitude] = latitudeRange;

  if (
    minLongitude < -180 ||
    maxLongitude > 180 ||
    minLongitude > maxLongitude
  ) {
    throw new Error("经度范围必须在 -180 到 180 之间");
  }

  if (
    minLatitude < -90 ||
    maxLatitude > 90 ||
    minLatitude > maxLatitude
  ) {
    throw new Error("纬度范围必须在 -90 到 90 之间");
  }

  // 生成32位十六进制唯一ID
  function createUniqueId() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    return Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");
  }

  function randomCoordinate(min, max) {
    return Number((min + Math.random() * (max - min)).toFixed(6));
  }

  return Array.from({ length: count }, (_, index) => ({
    id: createUniqueId(),
    name: `测试数据${index + 1}`,
    categoryId,
    categoryName,
    longitude: randomCoordinate(minLongitude, maxLongitude),
    latitude: randomCoordinate(minLatitude, maxLatitude),
    altitude: 0,
    description: `${categoryName}随机测试数据${index + 1}`,
    color,
  }));
}

// 使用方法
const Data = generateRandomTargets(
  "机场",             // categoryName
  10,                // 目标数量
  "#38bdf8",         // 颜色
  [115, 118],        // 经度范围
  [39, 41],          // 纬度范围
  "airport"          // categoryId，可省略
);

console.log(airportData);
console.table(airportData);