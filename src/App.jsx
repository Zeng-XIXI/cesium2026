import { useEffect, useMemo, useRef, useState } from "react";
import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  EllipsoidGeodesic,
  ImageryLayer,
  LabelStyle,
  OpenStreetMapImageryProvider,
  TileCoordinatesImageryProvider,
  VerticalOrigin,
  Viewer,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import AssistantPanel from "./components/AssistantPanel.jsx";
import MapToolButtons from "./components/MapToolButtons.jsx";
import TargetPanel from "./components/TargetPanel.jsx";
import { mockTargets } from "./data/mockTargets.js";
import { StaticTarget } from "./models/StaticTarget.js";
import {
  aggregateTargetsByGrid,
  getGridLevelByHeight,
} from "./utils/targetGrid.js";
import { getTargetIcon } from "./utils/targetIcons.js";
import {
  askLocalAssistant,
  streamDeepSeek,
} from "./services/assistantService.js";

const cssPixelMeters = 0.0254 / 96;

function readViewMetrics(viewer) {
  const { camera, scene } = viewer;
  const { clientWidth, clientHeight } = scene.canvas;
  const samplePixels = Math.min(100, clientWidth / 5);
  const center = new Cartesian2(clientWidth / 2, clientHeight / 2);
  const leftRay = camera.getPickRay(
    new Cartesian2(center.x - samplePixels / 2, center.y),
  );
  const rightRay = camera.getPickRay(
    new Cartesian2(center.x + samplePixels / 2, center.y),
  );
  const left = leftRay && scene.globe.pick(leftRay, scene);
  const right = rightRay && scene.globe.pick(rightRay, scene);
  let scale = null;

  if (left && right) {
    const distance = new EllipsoidGeodesic(
      Cartographic.fromCartesian(left),
      Cartographic.fromCartesian(right),
    ).surfaceDistance;
    scale = Math.round(distance / samplePixels / cssPixelMeters);
  }

  return {
    height: camera.positionCartographic.height,
    scale,
  };
}

function formatHeight(height) {
  return height >= 1000
    ? `${(height / 1000).toLocaleString("zh-CN", { maximumFractionDigits: 1 })} km`
    : `${Math.round(height)} m`;
}

function formatScale(scale) {
  return scale ? `1 : ${scale.toLocaleString("zh-CN")}` : "无法计算";
}

export default function App() {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const gridLayerRef = useRef(null);
  const gridLevelRef = useRef(getGridLevelByHeight(12_500_000));
  const [panelOpen, setPanelOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [gridVisible, setGridVisible] = useState(false);
  const [metricsVisible, setMetricsVisible] = useState(false);
  const [aggregationEnabled, setAggregationEnabled] = useState(true);
  const [aggregationRealtime, setAggregationRealtime] = useState(false);
  const [viewMetrics, setViewMetrics] = useState({
    height: 12_500_000,
    scale: null,
  });
  const [targets, setTargets] = useState(mockTargets);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [showTargetNames, setShowTargetNames] = useState(true);
  const [gridLevel, setGridLevel] = useState(gridLevelRef.current);
  const [message, setMessage] = useState("");
  const displayTargets = useMemo(
    () =>
      aggregateTargetsByGrid(
        targets.filter((target) => selectedIds.has(target.id)),
        aggregationEnabled ? gridLevel : null,
      ),
    [aggregationEnabled, gridLevel, selectedIds, targets],
  );

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

    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(104, 35, 12500000),
    });
    viewerRef.current = viewer;

    return () => {
      gridLayerRef.current = null;
      viewerRef.current = null;
      viewer.destroy();
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!aggregationEnabled || !viewer || viewer.isDestroyed()) {
      return undefined;
    }

    const updateGridLevel = () => {
      const nextLevel = getGridLevelByHeight(
        viewer.camera.positionCartographic.height,
      );
      if (gridLevelRef.current !== nextLevel) {
        gridLevelRef.current = nextLevel;
        setGridLevel(nextLevel);
      }
    };
    const event = aggregationRealtime
      ? viewer.scene.preRender
      : viewer.camera.moveEnd;

    event.addEventListener(updateGridLevel);
    updateGridLevel();

    return () => event.removeEventListener(updateGridLevel);
  }, [aggregationEnabled, aggregationRealtime]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!metricsVisible || !viewer || viewer.isDestroyed()) {
      return undefined;
    }

    const previousPercentageChanged = viewer.camera.percentageChanged;
    let lastUpdatedAt = -Infinity;
    const updateMetrics = () => {
      const now = performance.now();
      if (now - lastUpdatedAt < 100) {
        return;
      }
      lastUpdatedAt = now;
      setViewMetrics(readViewMetrics(viewer));
    };

    viewer.camera.percentageChanged = 0.001;
    viewer.camera.changed.addEventListener(updateMetrics);
    viewer.camera.moveEnd.addEventListener(updateMetrics);
    updateMetrics();

    return () => {
      viewer.camera.changed.removeEventListener(updateMetrics);
      viewer.camera.moveEnd.removeEventListener(updateMetrics);
      viewer.camera.percentageChanged = previousPercentageChanged;
    };
  }, [metricsVisible]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) {
      return undefined;
    }

    const clusterCategoryIds = [
      ...new Set(
        displayTargets
          .filter((target) => target.isCluster)
          .map((target) => target.categoryId),
      ),
    ];
    const entityIds = displayTargets.map((target) => {
      const entityId = `static-target:${target.id}`;
      const categoryIndex = clusterCategoryIds.indexOf(target.categoryId);
      const hasClusterOffset = target.isCluster && clusterCategoryIds.length > 1;
      const categoryAngle = hasClusterOffset
        ? (categoryIndex / clusterCategoryIds.length) * Math.PI * 2
        : 0;
      const clusterOffset = hasClusterOffset
        ? new Cartesian2(
            Math.round(Math.cos(categoryAngle) * 38),
            Math.round(Math.sin(categoryAngle) * 38),
          )
        : new Cartesian2(0, 0);

      viewer.entities.add({
        id: entityId,
        name: target.name,
        position: Cartesian3.fromDegrees(
          target.longitude,
          target.latitude,
          target.altitude,
        ),
        billboard: {
          image: getTargetIcon(
            target.categoryId,
            target.color,
            target.count,
          ),
          width: target.isCluster ? 44 : 36,
          height: target.isCluster ? 44 : 36,
          pixelOffset: clusterOffset,
          verticalOrigin: VerticalOrigin.CENTER,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          show: showTargetNames,
          text: target.isCluster
            ? `${target.categoryName} · ${target.count}`
            : target.name,
          font: "14px sans-serif",
          fillColor: Color.WHITE,
          style: LabelStyle.FILL,
          showBackground: true,
          backgroundColor: Color.BLACK.withAlpha(0.65),
          pixelOffset: new Cartesian2(clusterOffset.x, clusterOffset.y - 28),
          verticalOrigin: VerticalOrigin.BOTTOM,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        description: `${target.categoryName}<br>${target.description}<br>经度：${target.longitude}<br>纬度：${target.latitude}`,
      });

      return entityId;
    });

    return () => {
      if (!viewer.isDestroyed()) {
        entityIds.forEach((entityId) => viewer.entities.removeById(entityId));
      }
    };
  }, [displayTargets, showTargetNames]);

  function toggleTarget(targetId, checked) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(targetId);
      } else {
        next.delete(targetId);
      }
      return next;
    });
  }

  function toggleCategory(categoryTargets, checked) {
    setSelectedIds((current) => {
      const next = new Set(current);
      categoryTargets.forEach((target) => {
        if (checked) {
          next.add(target.id);
        } else {
          next.delete(target.id);
        }
      });
      return next;
    });
  }

  function toggleGrid() {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) {
      return;
    }

    if (gridLayerRef.current) {
      viewer.imageryLayers.remove(gridLayerRef.current, true);
      gridLayerRef.current = null;
      setGridVisible(false);
      return;
    }

    gridLayerRef.current = viewer.imageryLayers.addImageryProvider(
      new TileCoordinatesImageryProvider({
        color: Color.CYAN.withAlpha(0.8),
      }),
    );
    setGridVisible(true);
  }

  async function importTargets(file) {
    try {
      const content = JSON.parse(await file.text());
      const values = Array.isArray(content) ? content : content.targets;
      if (!Array.isArray(values) || values.length === 0) {
        throw new Error("文件中没有目标数据");
      }

      const importedTargets = values.map((value, index) =>
        StaticTarget.fromJSON(value, index),
      );
      const uniqueIds = new Set(importedTargets.map((target) => target.id));
      if (uniqueIds.size !== importedTargets.length) {
        throw new Error("目标 ID 不能重复");
      }

      setTargets(importedTargets);
      setSelectedIds(new Set());
      setMessage(`已导入 ${importedTargets.length} 个目标，原数据已替换`);
    } catch (error) {
      setMessage(`导入失败：${error.message}`);
    }
  }

  function exportTargets() {
    const content = JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        targets: targets.map((target) => target.toJSON()),
      },
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([content], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "static-targets.json";
    link.click();
    URL.revokeObjectURL(url);
    setMessage(`已导出 ${targets.length} 个目标`);
  }

  async function handleAssistantMessage(userMessage, mode, onProgress) {
    if (mode === "deepseek") {
      return streamDeepSeek(userMessage, onProgress);
    }

    const categories = [...new Set(targets.map((target) => target.categoryId))].map(
      (categoryId) => {
        const categoryTargets = targets.filter(
          (target) => target.categoryId === categoryId,
        );
        return {
          id: categoryId,
          name: categoryTargets[0].categoryName,
          count: categoryTargets.length,
        };
      },
    );
    const result = askLocalAssistant(userMessage, {
      targetCount: targets.length,
      selectedCount: selectedIds.size,
      targetPanelOpen: panelOpen,
      categories,
    });

    const allowedActions = new Set([
      "open-target-panel",
      "close-target-panel",
      "clear-all-targets",
      "select-all-targets",
      "select-category",
      "deselect-category",
    ]);
    const actions = result.actions.filter((action) =>
      allowedActions.has(action.type),
    );

    actions.forEach((action) => {
      if (action.type === "open-target-panel") {
        setPanelOpen(true);
      }
      if (action.type === "close-target-panel") {
        setPanelOpen(false);
      }
    });

    setSelectedIds((current) => {
      const next = new Set(current);

      actions.forEach((action) => {
        if (action.type === "clear-all-targets") {
          next.clear();
        }
        if (action.type === "select-all-targets") {
          targets.forEach((target) => next.add(target.id));
        }
        if (
          action.type === "select-category" ||
          action.type === "deselect-category"
        ) {
          targets
            .filter((target) => target.categoryId === action.categoryId)
            .forEach((target) => {
              if (action.type === "select-category") {
                next.add(target.id);
              } else {
                next.delete(target.id);
              }
            });
        }
      });

      return next;
    });

    onProgress(result.reply);
    return result.reply;
  }

  return (
    <main className="app-shell">
      <div ref={containerRef} className="cesium-container" />

      <MapToolButtons
        assistantOpen={assistantOpen}
        gridVisible={gridVisible}
        metricsVisible={metricsVisible}
        selectedCount={selectedIds.size}
        targetPanelOpen={panelOpen}
        onToggleAssistant={() => setAssistantOpen((open) => !open)}
        onToggleGrid={toggleGrid}
        onToggleMetrics={() => setMetricsVisible((visible) => !visible)}
        onToggleTargetPanel={() => setPanelOpen((open) => !open)}
      />

      {metricsVisible && (
        <section className="view-metrics-panel" aria-label="实时视角信息">
          <span>视角高度</span>
          <strong>{formatHeight(viewMetrics.height)}</strong>
          <span>中心比例尺</span>
          <strong>{formatScale(viewMetrics.scale)}</strong>
        </section>
      )}

      {panelOpen && (
        <TargetPanel
          targets={targets}
          selectedIds={selectedIds}
          displayCount={displayTargets.length}
          aggregationEnabled={aggregationEnabled}
          aggregationRealtime={aggregationRealtime}
          showTargetNames={showTargetNames}
          message={message}
          onClose={() => setPanelOpen(false)}
          onImport={importTargets}
          onExport={exportTargets}
          onToggleAggregation={setAggregationEnabled}
          onToggleAggregationRealtime={setAggregationRealtime}
          onToggleCategory={toggleCategory}
          onToggleTargetNames={setShowTargetNames}
          onToggleTarget={toggleTarget}
        />
      )}

      {assistantOpen && (
        <AssistantPanel
          onClose={() => setAssistantOpen(false)}
          onSend={handleAssistantMessage}
        />
      )}
    </main>
  );
}
