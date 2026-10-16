export class StaticTarget {
  constructor({
    id,
    name,
    categoryId,
    categoryName,
    longitude,
    latitude,
    altitude = 0,
    description = "",
    color = "#38bdf8",
  }) {
    this.id = id;
    this.name = name;
    this.categoryId = categoryId;
    this.categoryName = categoryName;
    this.longitude = longitude;
    this.latitude = latitude;
    this.altitude = altitude;
    this.description = description;
    this.color = color;
  }

  static fromJSON(value, index) {
    const longitude = Number(value.longitude);
    const latitude = Number(value.latitude);
    const altitude = Number(value.altitude ?? 0);

    if (!value.id || !value.name || !value.categoryId || !value.categoryName) {
      throw new Error(`第 ${index + 1} 条数据缺少必要字段`);
    }

    if (
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      longitude < -180 ||
      longitude > 180 ||
      latitude < -90 ||
      latitude > 90
    ) {
      throw new Error(`第 ${index + 1} 条数据的经纬度无效`);
    }

    return new StaticTarget({
      ...value,
      longitude,
      latitude,
      altitude: Number.isFinite(altitude) ? altitude : 0,
    });
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      categoryId: this.categoryId,
      categoryName: this.categoryName,
      longitude: this.longitude,
      latitude: this.latitude,
      altitude: this.altitude,
      description: this.description,
      color: this.color,
    };
  }
}
