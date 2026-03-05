<template>
    <div id="cesiumContainer" class="cesium-container"></div>
</template>

<script setup>
import { onMounted } from "vue";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

onMounted(async () => {
    Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4Mzk1Njk2ZC1iZjU5LTQ2ZGQtOWU4ZS1kYTdiZmM4ZTUwYzAiLCJpZCI6Mzk4NTEwLCJpYXQiOjE3NzI3MDEwMTJ9.2cYQvBlD_WV8XDvtybuJO9E-ZAQjwwcnmfqnOy7TQsU";
    const viewer = new Cesium.Viewer("cesiumContainer", {
        terrain: Cesium.Terrain.fromWorldTerrain(),
        baseLayerPicker: true
    });

    // Fly the camera to San Francisco at the given longitude, latitude, and height.
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-122.4175, 37.655, 400),
        orientation: {
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(-15.0),
        }
    });

    // Add Cesium OSM Buildings, a global 3D buildings layer.
    const buildingTileset = await Cesium.createOsmBuildingsAsync();
    viewer.scene.primitives.add(buildingTileset)


});
</script>

<style scoped>
.cesium-container {
    width: 100vw;
    height: 100vh;
}
</style>