function TargetDataIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="7" ry="3" />
      <path d="M5 5v5c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
      <path d="M5 10v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
    </svg>
  );
}

function AssistantIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 5.5h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-6l-4.5 3v-3H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />
      <path d="m12 7 .7 1.8L14.5 9.5l-1.8.7L12 12l-.7-1.8-1.8-.7 1.8-.7L12 7Z" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" />
      <path d="M12 4v16M4 12h16" />
    </svg>
  );
}

function ViewMetricsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 18h14M7 15l10-10M8 8l2 2M11 5l2 2M14 12l2 2" />
    </svg>
  );
}

function OperationStatusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 5h12v14H6z" />
      <path d="M9 9h6M9 12h6M9 15h4" />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
  );
}

function NearbyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="m15 15 5 5M10.5 8v5M8 10.5h5" />
    </svg>
  );
}

function TestDataIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v5h5M9 12h6M12 9v6" />
    </svg>
  );
}

export default function MapToolButtons({
  assistantOpen,
  gridVisible,
  metricsVisible,
  operationStatusVisible,
  circlePanelOpen,
  nearbyPanelOpen,
  testDataPanelOpen,
  selectedCount,
  targetPanelOpen,
  onToggleAssistant,
  onToggleGrid,
  onToggleMetrics,
  onToggleOperationStatus,
  onToggleCirclePanel,
  onToggleNearbyPanel,
  onToggleTestDataPanel,
  onToggleTargetPanel,
}) {
  return (
    <nav className="map-tool-buttons" aria-label="地图工具">
      <button
        className={`map-tool-button ${targetPanelOpen ? "is-active" : ""}`}
        type="button"
        aria-label="目标数据"
        aria-pressed={targetPanelOpen}
        data-tooltip="目标数据"
        onClick={onToggleTargetPanel}
      >
        <TargetDataIcon />
        {selectedCount > 0 && (
          <span className="tool-count-badge">{selectedCount}</span>
        )}
      </button>
      <button
        className={`map-tool-button ${metricsVisible ? "is-active" : ""}`}
        type="button"
        aria-label="视角信息"
        aria-pressed={metricsVisible}
        data-tooltip="视角信息"
        onClick={onToggleMetrics}
      >
        <ViewMetricsIcon />
      </button>
      <button
        className={`map-tool-button ${gridVisible ? "is-active" : ""}`}
        type="button"
        aria-label="剖分网格"
        aria-pressed={gridVisible}
        data-tooltip="剖分网格"
        onClick={onToggleGrid}
      >
        <GridIcon />
      </button>
      <button
        className={`map-tool-button ${operationStatusVisible ? "is-active" : ""}`}
        type="button"
        aria-label="操作状态"
        aria-pressed={operationStatusVisible}
        data-tooltip="操作状态"
        onClick={onToggleOperationStatus}
      >
        <OperationStatusIcon />
      </button>
      <button
        className={`map-tool-button ${circlePanelOpen ? "is-active" : ""}`}
        type="button"
        aria-label="圆形标绘"
        aria-pressed={circlePanelOpen}
        data-tooltip="圆形标绘"
        onClick={onToggleCirclePanel}
      >
        <CircleIcon />
      </button>
      <button
        className={`map-tool-button ${nearbyPanelOpen ? "is-active" : ""}`}
        type="button"
        aria-label="近邻查询"
        aria-pressed={nearbyPanelOpen}
        data-tooltip="近邻查询"
        onClick={onToggleNearbyPanel}
      >
        <NearbyIcon />
      </button>
      <button
        className={`map-tool-button ${testDataPanelOpen ? "is-active" : ""}`}
        type="button"
        aria-label="添加测试数据"
        aria-pressed={testDataPanelOpen}
        data-tooltip="添加测试数据"
        onClick={onToggleTestDataPanel}
      >
        <TestDataIcon />
      </button>
      <button
        className={`map-tool-button ${assistantOpen ? "is-active" : ""}`}
        type="button"
        aria-label="智能助手"
        aria-pressed={assistantOpen}
        data-tooltip="智能助手"
        onClick={onToggleAssistant}
      >
        <AssistantIcon />
      </button>
    </nav>
  );
}
