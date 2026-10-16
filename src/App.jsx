import { useEffect, useRef } from "react";
import {
  ImageryLayer,
  OpenStreetMapImageryProvider,
  Viewer,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

export default function App() {
  const containerRef = useRef(null);

  useEffect(() => {
    const viewer = new Viewer(containerRef.current, {
      baseLayer: new ImageryLayer(
        new OpenStreetMapImageryProvider({
          url: "https://tile.openstreetmap.org/",
        }),
      ),
      baseLayerPicker: false,
      geocoder: false,
    });

    return () => viewer.destroy();
  }, []);

  return <div ref={containerRef} className="cesium-container" />;
}
