import { useEffect, useRef, useState } from "react";
import {
  Cartesian2,
  Cartesian3,
  Color,
  ImageryLayer,
  LabelStyle,
  OpenStreetMapImageryProvider,
  VerticalOrigin,
  Viewer,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import AssistantPanel from "./components/AssistantPanel.jsx";
import MapToolButtons from "./components/MapToolButtons.jsx";
import TargetPanel from "./components/TargetPanel.jsx";
import { mockTargets } from "./data/mockTargets.js";
import { StaticTarget } from "./models/StaticTarget.js";
import { getTargetIcon } from "./utils/targetIcons.js";
import {
  askLocalAssistant,
  streamDeepSeek,
} from "./services/assistantService.js";

export default function App() {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [targets, setTargets] = useState(mockTargets);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [showTargetNames, setShowTargetNames] = useState(true);
  const [message, setMessage] = useState("");

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
      viewerRef.current = null;
      viewer.destroy();
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) {
      return undefined;
    }

    const entityIds = targets
      .filter((target) => selectedIds.has(target.id))
      .map((target) => {
        const entityId = `static-target:${target.id}`;

        viewer.entities.add({
          id: entityId,
          name: target.name,
          position: Cartesian3.fromDegrees(
            target.longitude,
            target.latitude,
            target.altitude,
          ),
          billboard: {
            image: getTargetIcon(target.categoryId, target.color),
            width: 36,
            height: 36,
            verticalOrigin: VerticalOrigin.CENTER,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            show: showTargetNames,
            text: target.name,
            font: "14px sans-serif",
            fillColor: Color.WHITE,
            style: LabelStyle.FILL,
            showBackground: true,
            backgroundColor: Color.BLACK.withAlpha(0.65),
            pixelOffset: new Cartesian2(0, -28),
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
  }, [selectedIds, showTargetNames, targets]);

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
        selectedCount={selectedIds.size}
        targetPanelOpen={panelOpen}
        onToggleAssistant={() => setAssistantOpen((open) => !open)}
        onToggleTargetPanel={() => setPanelOpen((open) => !open)}
      />

      {panelOpen && (
        <TargetPanel
          targets={targets}
          selectedIds={selectedIds}
          showTargetNames={showTargetNames}
          message={message}
          onClose={() => setPanelOpen(false)}
          onImport={importTargets}
          onExport={exportTargets}
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
