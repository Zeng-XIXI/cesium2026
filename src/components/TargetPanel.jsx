import { useEffect, useMemo, useRef, useState } from "react";

function CategoryGroup({
  category,
  expanded,
  selectedIds,
  onToggleExpanded,
  onToggleCategory,
  onToggleTarget,
}) {
  const checkboxRef = useRef(null);
  const selectedCount = category.targets.filter((target) =>
    selectedIds.has(target.id),
  ).length;
  const allSelected = selectedCount === category.targets.length;

  useEffect(() => {
    checkboxRef.current.indeterminate =
      selectedCount > 0 && selectedCount < category.targets.length;
  }, [category.targets.length, selectedCount]);

  return (
    <section className="target-category">
      <div className="category-row">
        <button
          className={`expand-button ${expanded ? "is-expanded" : ""}`}
          type="button"
          aria-label={`${expanded ? "收起" : "展开"}${category.name}`}
          onClick={() => onToggleExpanded(category.id)}
        >
          ›
        </button>
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={allSelected}
          onChange={(event) =>
            onToggleCategory(category.targets, event.target.checked)
          }
        />
        <span
          className="category-color"
          style={{ backgroundColor: category.color }}
        />
        <button
          className="category-name"
          type="button"
          onClick={() => onToggleExpanded(category.id)}
        >
          {category.name}
        </button>
        <span className="category-count">
          {selectedCount}/{category.targets.length}
        </span>
      </div>

      {expanded && (
        <div className="target-items">
          {category.targets.map((target) => (
            <label className="target-item" key={target.id}>
              <input
                type="checkbox"
                checked={selectedIds.has(target.id)}
                onChange={(event) =>
                  onToggleTarget(target.id, event.target.checked)
                }
              />
              <span className="target-item-content">
                <span className="target-name">{target.name}</span>
                <span className="target-coordinate">
                  {target.longitude.toFixed(4)}, {target.latitude.toFixed(4)}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
    </section>
  );
}

export default function TargetPanel({
  targets,
  selectedIds,
  displayCount,
  showTargetNames,
  message,
  onClose,
  onImport,
  onExport,
  onToggleCategory,
  onToggleTargetNames,
  onToggleTarget,
}) {
  const fileInputRef = useRef(null);
  const [expandedIds, setExpandedIds] = useState(() => new Set(["airport"]));
  const categories = useMemo(() => {
    const groups = new Map();

    targets.forEach((target) => {
      if (!groups.has(target.categoryId)) {
        groups.set(target.categoryId, {
          id: target.categoryId,
          name: target.categoryName,
          color: target.color,
          targets: [],
        });
      }
      groups.get(target.categoryId).targets.push(target);
    });

    return [...groups.values()];
  }, [targets]);

  function toggleExpanded(categoryId) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }

  async function handleFileChange(event) {
    const [file] = event.target.files;
    if (file) {
      await onImport(file);
    }
    event.target.value = "";
  }

  return (
    <aside className="target-panel" aria-label="目标数据列表">
      <header className="target-panel-header">
        <div>
          <h1>目标数据</h1>
          <p>
            已选择 {selectedIds.size} / {targets.length} · 地图显示 {displayCount}
          </p>
        </div>
        <button
          className="panel-close-button"
          type="button"
          aria-label="关闭目标数据列表"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className="target-actions">
        <button type="button" onClick={() => fileInputRef.current.click()}>
          导入 JSON
        </button>
        <button type="button" onClick={onExport}>
          导出 JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={handleFileChange}
        />
      </div>

      {message && <p className="target-message">{message}</p>}

      <label className="target-label-control">
        <span>
          <strong>显示目标名称</strong>
          <small>统一控制地图上所有点位标签</small>
        </span>
        <span className="switch-control">
          <input
            type="checkbox"
            checked={showTargetNames}
            onChange={(event) => onToggleTargetNames(event.target.checked)}
          />
          <span className="switch-track" aria-hidden="true" />
        </span>
      </label>

      <div className="target-category-list">
        {categories.map((category) => (
          <CategoryGroup
            key={category.id}
            category={category}
            expanded={expandedIds.has(category.id)}
            selectedIds={selectedIds}
            onToggleExpanded={toggleExpanded}
            onToggleCategory={onToggleCategory}
            onToggleTarget={onToggleTarget}
          />
        ))}
      </div>
    </aside>
  );
}
