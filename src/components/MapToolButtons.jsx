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

export default function MapToolButtons({
  assistantOpen,
  selectedCount,
  targetPanelOpen,
  onToggleAssistant,
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
