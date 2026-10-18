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
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  TileCoordinatesImageryProvider,
  VerticalOrigin,
  Viewer,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import AssistantPanel from "./components/AssistantPanel.jsx";
import CirclePanel from "./components/CirclePanel.jsx";
import MapToolButtons from "./components/MapToolButtons.jsx";
import NearbyPanel from "./components/NearbyPanel.jsx";
import TestDataPanel from "./components/TestDataPanel.jsx";
import useDraggable from "./hooks/useDraggable.js";
import TargetPanel from "./components/TargetPanel.jsx";
import { mockTargets } from "./data/mockTargets.js";
import { StaticTarget } from "./models/StaticTarget.js";
import {
  aggregateTargetsByGrid,
  getGridLevelByHeight,
} from "./utils/targetGrid.js";
import { getTargetIcon } from "./utils/targetIcons.js";
import {
  buildSpatialHash,
  queryNearbyTargets,
} from "./utils/nearbyQuery.js";
import { createTestTargets } from "./utils/testTargets.js";
import {
  askLocalAssistant,
  streamDeepSeek,
} from "./services/assistantService.js";

const cssPixelMeters = 0.0254 / 96;

// 操作状态最多保留的消息数量，可按需调整。
const MAX_OPERATION_STATUSES = 8;
// 操作状态左侧时间的显示格式，可按需调整。
const OPERATION_STATUS_TIME_OPTIONS = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
};

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

function formatOperationStatusTime(date) {
  return new Intl.DateTimeFormat(
    "zh-CN",
    OPERATION_STATUS_TIME_OPTIONS,
  ).format(date);
}

function calculateTargetStatistics(rows) {
  const categoryCounts = rows.reduce((result, row) => {
    const categoryName = row.categoryName || "未分类";
    result[categoryName] = (result[categoryName] || 0) + 1;
    return result;
  }, {});
  const longitudes = rows.map((row) => Number(row.longitude));
  const latitudes = rows.map((row) => Number(row.latitude));

  return {
    total: rows.length,
    categoryCounts,
    longitudeRange: longitudes.length
      ? [Math.min(...longitudes), Math.max(...longitudes)]
      : [],
    latitudeRange: latitudes.length
      ? [Math.min(...latitudes), Math.max(...latitudes)]
      : [],
  };
}

function buildSummaryPrompt(question, statistics) {
  return `请根据用户问题和程序计算出的真实统计结果，生成简洁的最终总结。
不要编造或修改任何目标数量、类别数量、经纬度范围；如果数据为空，请明确说明没有查询到目标。

用户问题：${question}

程序统计结果：
${JSON.stringify(statistics, null, 2)}`;
}

function queryTargetsFromLocalData(targets, toolCall) {
  const categoryId = toolCall.arguments?.categoryId;
  return categoryId
    ? targets.filter((target) => target.categoryId === categoryId)
    : targets;
}

export default function App() {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const gridLayerRef = useRef(null);
  const gridLevelRef = useRef(getGridLevelByHeight(12_500_000));
  const [panelOpen, setPanelOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [circlePanelOpen, setCirclePanelOpen] = useState(false);
  const [nearbyPanelOpen, setNearbyPanelOpen] = useState(false);
  const [testDataPanelOpen, setTestDataPanelOpen] = useState(false);
  const [circlePickMode, setCirclePickMode] = useState(false);
  const [nearbyPickMode, setNearbyPickMode] = useState(false);
  const [gridVisible, setGridVisible] = useState(false);
  const [metricsVisible, setMetricsVisible] = useState(false);
  const [operationStatusVisible, setOperationStatusVisible] = useState(false);
  const [operationStatuses, setOperationStatuses] = useState([]);
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
  const [circles, setCircles] = useState([]);
  const [selectedCircleId, setSelectedCircleId] = useState(null);
  const [pickedCirclePoint, setPickedCirclePoint] = useState(null);
  const [pickedNearbyPoint, setPickedNearbyPoint] = useState(null);
  const [nearbyQueryResult, setNearbyQueryResult] = useState(null);
  const [nearbyQueryError, setNearbyQueryError] = useState("");
  const [nearbySelectedIds, setNearbySelectedIds] = useState(() => new Set());
  const operationStatusIdRef = useRef(0);
  const circleIdRef = useRef(0);
  const metricsDrag = useDraggable();
  const operationStatusDrag = useDraggable();
  const spatialHash = useMemo(() => buildSpatialHash(targets), [targets]);
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

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) {
      return undefined;
    }

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement) => {
      if (circlePickMode || nearbyPickMode) {
        const ray = viewer.camera.getPickRay(movement.position);
        const cartesian =
          (ray && viewer.scene.globe.pick(ray, viewer.scene)) ||
          viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid);
        if (cartesian) {
          const cartographic = Cartographic.fromCartesian(cartesian);
          const point = {
            longitude: Number(((cartographic.longitude * 180) / Math.PI).toFixed(6)),
            latitude: Number(((cartographic.latitude * 180) / Math.PI).toFixed(6)),
          };
          if (circlePickMode) {
            setPickedCirclePoint(point);
            setCirclePickMode(false);
            pushOperationStatus("已从地图选取圆心坐标");
          } else {
            setPickedNearbyPoint(point);
            setNearbyPickMode(false);
            pushOperationStatus("已从地图选取近邻查询点");
          }
        }
        return;
      }

      const picked = viewer.scene.pick(movement.position);
      const entity = picked?.id;
      const entityId = typeof entity === "string" ? entity : entity?.id;
      if (entityId?.startsWith("map-circle:")) {
        setSelectedCircleId(entityId.slice("map-circle:".length));
      } else {
        setSelectedCircleId(null);
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    return () => handler.destroy();
  }, [circlePickMode, nearbyPickMode]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) {
      return undefined;
    }

    const visibleCircleIds = circles
      .filter((circle) => circle.visible)
      .map((circle) => {
        const entityId = `map-circle:${circle.id}`;
        const color = Color.fromCssColorString(circle.color);
        viewer.entities.add({
          id: entityId,
          name: circle.id,
          position: Cartesian3.fromDegrees(circle.longitude, circle.latitude),
          ellipse: {
            semiMajorAxis: circle.radius * 1000,
            semiMinorAxis: circle.radius * 1000,
            height: 0,
            material: color.withAlpha(0.2),
            outline: true,
            outlineColor: color,
            outlineWidth: selectedCircleId === circle.id ? 4 : 2,
          },
        });
        return entityId;
      });

    return () => {
      if (!viewer.isDestroyed()) {
        visibleCircleIds.forEach((entityId) => viewer.entities.removeById(entityId));
      }
    };
  }, [circles, selectedCircleId]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== "Delete" || !selectedCircleId) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)
      ) {
        return;
      }
      event.preventDefault();
      deleteCircle(selectedCircleId);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCircleId]);

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
      pushOperationStatus("已关闭剖分网格");
      return;
    }

    gridLayerRef.current = viewer.imageryLayers.addImageryProvider(
      new TileCoordinatesImageryProvider({
        color: Color.CYAN.withAlpha(0.8),
      }),
    );
    setGridVisible(true);
    pushOperationStatus("已打开剖分网格");
  }

  function pushOperationStatus(text) {
    setOperationStatuses((current) => [
      {
        id: ++operationStatusIdRef.current,
        time: formatOperationStatusTime(new Date()),
        text,
      },
      ...current,
    ].slice(0, MAX_OPERATION_STATUSES));
  }

  function createCircle(values) {
    const id = `circle-${String(circleIdRef.current + 1).padStart(3, "0")}`;
    circleIdRef.current += 1;
    setCircles((current) => [...current, { id, ...values, visible: true }]);
    setSelectedCircleId(id);
    pushOperationStatus(`已创建圆圈 ${id}`);
  }

  function toggleCircle(circleId, visible) {
    setCircles((current) =>
      current.map((circle) =>
        circle.id === circleId ? { ...circle, visible } : circle,
      ),
    );
    pushOperationStatus(visible ? `已显示圆圈 ${circleId}` : `已隐藏圆圈 ${circleId}`);
  }

  function toggleAllCircles(visible) {
    setCircles((current) => current.map((circle) => ({ ...circle, visible })));
    pushOperationStatus(visible ? "已显示全部圆圈" : "已隐藏全部圆圈");
  }

  function deleteCircle(circleId) {
    setCircles((current) => current.filter((circle) => circle.id !== circleId));
    setSelectedCircleId((current) => (current === circleId ? null : current));
    pushOperationStatus(`已删除圆圈 ${circleId}`);
  }

  function locateCircle(circle) {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) {
      return;
    }
    const height = viewer.camera.positionCartographic.height;
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(circle.longitude, circle.latitude, height),
      orientation: {
        heading: viewer.camera.heading,
        pitch: viewer.camera.pitch,
        roll: viewer.camera.roll,
      },
      duration: 0.6,
    });
    setSelectedCircleId(circle.id);
    pushOperationStatus(`视角已定位到圆圈 ${circle.id}`);
  }

  function closeCirclePanel() {
    setCirclePanelOpen(false);
    setCirclePickMode(false);
  }

  function closeNearbyPanel() {
    setNearbyPanelOpen(false);
    setNearbyPickMode(false);
  }

  function addTestTargets(values) {
    const existingCategory = targets.find(
      (target) => target.categoryName === values.categoryName,
    );
    const categoryId =
      existingCategory?.categoryId ||
      `test-${values.categoryName.toLowerCase().replace(/\s+/g, "-")}`;
    const generatedTargets = createTestTargets({
      ...values,
      categoryId,
      existingIds: targets.map((target) => target.id),
    }).map((target) => new StaticTarget(target));

    setTargets((current) => [...current, ...generatedTargets]);
    setNearbySelectedIds(new Set());
    setMessage(`已生成 ${generatedTargets.length} 个${values.categoryName}测试目标`);
    pushOperationStatus(
      `已生成 ${generatedTargets.length} 个${values.categoryName}测试目标，并加入目标数据`,
    );
  }

  function toggleCirclePickMode(enabled) {
    setCirclePickMode(enabled);
    if (enabled) {
      setNearbyPickMode(false);
    }
  }

  function toggleNearbyPickMode(enabled) {
    setNearbyPickMode(enabled);
    if (enabled) {
      setCirclePickMode(false);
    }
  }

  function runNearbyQuery(options, errorMessage) {
    if (errorMessage) {
      setNearbyQueryResult(null);
      setNearbyQueryError(errorMessage);
      return;
    }

    const result = queryNearbyTargets(targets, { ...options, spatialHash });
    setNearbyQueryError("");
    setNearbySelectedIds(new Set());
    setNearbyQueryResult({
      ...result,
      methodLabel:
        options.method === "spatial-hash"
          ? "方法二：Spatial Hash"
          : "方法一：全量遍历",
    });
    pushOperationStatus(
      options.queryType === "nearest"
        ? `已完成最近 ${options.limit} 个目标查询`
        : `已完成 ${options.radiusKm} km 范围目标查询`,
    );
  }

  function toggleNearbyTarget(target, checked) {
    setNearbySelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(target.id);
      } else {
        next.delete(target.id);
      }
      return next;
    });
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(target.id);
      } else {
        next.delete(target.id);
      }
      return next;
    });
    pushOperationStatus(
      checked ? `已将目标 ${target.id} 上图` : `已取消目标 ${target.id} 上图`,
    );
  }

  function toggleAllNearbyTargets(checked) {
    const resultTargets = nearbyQueryResult?.rows || [];
    setNearbySelectedIds(
      checked ? new Set(resultTargets.map((target) => target.id)) : new Set(),
    );
    setSelectedIds((current) => {
      const next = new Set(current);
      resultTargets.forEach((target) => {
        if (checked) {
          next.add(target.id);
        } else {
          next.delete(target.id);
        }
      });
      return next;
    });
    pushOperationStatus(checked ? "已将近邻查询结果全部上图" : "已取消近邻查询结果上图");
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
      setNearbySelectedIds(new Set());
      setMessage(`已导入 ${importedTargets.length} 个目标，原数据已替换`);
      pushOperationStatus(`已导入 ${importedTargets.length} 个目标`);
    } catch (error) {
      setMessage(`导入失败：${error.message}`);
      pushOperationStatus(`导入失败：${error.message}`);
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
    pushOperationStatus(`已导出 ${targets.length} 个目标`);
  }

  async function handleAssistantMessage(
    userMessage,
    mode,
    onProgress,
    onInsertBlock,
  ) {
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

    if (mode === "deepseek") {
      const phaseOne = await streamDeepSeek(
        userMessage,
        { categories, stage: "analysis" },
        onProgress,
      );
      applyAssistantActions(phaseOne.actions);

      const queryCall = phaseOne.toolCalls.find(
        (toolCall) => toolCall.name === "query_targets",
      );
      if (!queryCall) {
        if (!phaseOne.reply) {
          onProgress(formatAssistantActions(phaseOne.actions, categories));
        }
        return null;
      }

      if (!phaseOne.reply) {
        onProgress("已识别查询意图，正在查询真实目标数据。");
      }

      const rows = queryTargetsFromLocalData(targets, queryCall);
      onInsertBlock({ type: "table", rows });

      const summaryBlockId = onInsertBlock({
        type: "text",
        content: "",
      });
      const summary = await streamDeepSeek(
        buildSummaryPrompt(userMessage, calculateTargetStatistics(rows)),
        { categories, stage: "summary" },
        (text) => onProgress(text, summaryBlockId),
      );
      if (!summary.reply) {
        onProgress("已完成真实目标数据统计。", summaryBlockId);
      }
      return null;
    }

    const result = askLocalAssistant(userMessage, {
      targetCount: targets.length,
      selectedCount: selectedIds.size,
      targetPanelOpen: panelOpen,
      categories,
    });

    applyAssistantActions(result.actions);
    onProgress(result.reply);
    return result.reply;
  }

  function applyAssistantActions(inputActions) {
    const allowedActions = new Set([
      "open-target-panel",
      "close-target-panel",
      "clear-all-targets",
      "select-all-targets",
      "select-category",
      "deselect-category",
    ]);
    const actions = inputActions.filter((action) =>
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
  }

  function formatAssistantActions(actions, categories) {
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    const messages = actions.map((action) => {
      if (action.type === "select-category") {
        return `已显示全部${categoryById.get(action.categoryId)?.name || "目标"}。`;
      }
      if (action.type === "deselect-category") {
        return `已隐藏全部${categoryById.get(action.categoryId)?.name || "目标"}。`;
      }
      if (action.type === "select-all-targets") {
        return `已显示全部 ${targets.length} 个目标。`;
      }
      if (action.type === "clear-all-targets") {
        return "已清空地图上的全部目标。";
      }
      if (action.type === "open-target-panel") {
        return "已打开左侧目标数据列表。";
      }
      if (action.type === "close-target-panel") {
        return "已关闭左侧目标数据列表。";
      }
      return "已执行地图操作。";
    });
    return messages.join("\n\n") || "已处理你的地图指令。";
  }

  return (
    <main className="app-shell">
      <div ref={containerRef} className="cesium-container" />

      <MapToolButtons
        assistantOpen={assistantOpen}
        circlePanelOpen={circlePanelOpen}
        nearbyPanelOpen={nearbyPanelOpen}
        testDataPanelOpen={testDataPanelOpen}
        gridVisible={gridVisible}
        metricsVisible={metricsVisible}
        operationStatusVisible={operationStatusVisible}
        selectedCount={selectedIds.size}
        targetPanelOpen={panelOpen}
        onToggleAssistant={() => setAssistantOpen((open) => !open)}
        onToggleCirclePanel={() => setCirclePanelOpen((open) => !open)}
        onToggleNearbyPanel={() => setNearbyPanelOpen((open) => !open)}
        onToggleTestDataPanel={() => setTestDataPanelOpen((open) => !open)}
        onToggleGrid={toggleGrid}
        onToggleMetrics={() => setMetricsVisible((visible) => !visible)}
        onToggleOperationStatus={() =>
          setOperationStatusVisible((visible) => !visible)
        }
        onToggleTargetPanel={() => setPanelOpen((open) => !open)}
      />

      {circlePanelOpen && (
        <CirclePanel
          circles={circles}
          pickedPoint={pickedCirclePoint}
          pickMode={circlePickMode}
          selectedCircleId={selectedCircleId}
          onClose={closeCirclePanel}
          onCreate={createCircle}
          onTogglePickMode={toggleCirclePickMode}
          onToggleCircle={toggleCircle}
          onToggleAll={toggleAllCircles}
          onLocate={locateCircle}
          onDelete={deleteCircle}
          onSelectCircle={setSelectedCircleId}
        />
      )}

      {nearbyPanelOpen && (
        <NearbyPanel
          checkedIds={nearbySelectedIds}
          error={nearbyQueryError}
          pickedPoint={pickedNearbyPoint}
          pickMode={nearbyPickMode}
          queryResult={nearbyQueryResult}
          onClose={closeNearbyPanel}
          onQuery={runNearbyQuery}
          onToggleAll={toggleAllNearbyTargets}
          onTogglePickMode={toggleNearbyPickMode}
          onToggleTarget={toggleNearbyTarget}
        />
      )}

      {testDataPanelOpen && (
        <TestDataPanel
          onClose={() => setTestDataPanelOpen(false)}
          onGenerate={addTestTargets}
        />
      )}

      {operationStatusVisible && (
        <section
          className="operation-status-panel"
          aria-label="操作状态"
          style={operationStatusDrag.dragStyle}
          onPointerDown={operationStatusDrag.handlePointerDown}
        >
          <h2>操作状态</h2>
          <div className="operation-status-list" aria-live="polite">
            {operationStatuses.length > 0 ? (
              operationStatuses.map((status) => (
                <p key={status.id} className="operation-status-item">
                  <time>{status.time}</time>
                  <span>{status.text}</span>
                </p>
              ))
            ) : (
              <p className="operation-status-empty">暂无操作状态</p>
            )}
          </div>
        </section>
      )}

      {metricsVisible && (
        <section
          className="view-metrics-panel"
          aria-label="实时视角信息"
          style={metricsDrag.dragStyle}
          onPointerDown={metricsDrag.handlePointerDown}
        >
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
          onOperationStatus={pushOperationStatus}
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
