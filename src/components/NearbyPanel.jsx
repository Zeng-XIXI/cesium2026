import { useEffect, useRef, useState } from "react";
import { SPATIAL_HASH_CELL_KM } from "../utils/nearbyQuery.js";
import useDraggable from "../hooks/useDraggable.js";

const INITIAL_FORM = {
  longitude: "104",
  latitude: "35",
  queryType: "nearest",
  limit: "5",
  radiusKm: "100",
  method: "full-scan",
};

const VIRTUAL_ROW_HEIGHT = 36;
const VIRTUAL_VIEWPORT_HEIGHT = 330;

function VirtualResultTable({ rows, checkedIds, onToggleAll, onToggleTarget }) {
  const [scrollTop, setScrollTop] = useState(0);
  const selectAllRef = useRef(null);
  const totalHeight = rows.length * VIRTUAL_ROW_HEIGHT;
  const checkedCount = rows.filter((row) => checkedIds.has(row.id)).length;
  const allChecked = rows.length > 0 && checkedCount === rows.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        checkedCount > 0 && checkedCount < rows.length;
    }
  }, [checkedCount, rows.length]);
  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - 4,
  );
  const visibleRows = rows.slice(
    startIndex,
    startIndex + Math.ceil(VIRTUAL_VIEWPORT_HEIGHT / VIRTUAL_ROW_HEIGHT) + 8,
  );

  useEffect(() => {
    setScrollTop(0);
  }, [rows]);

  return (
    <div className="nearby-table-wrapper" role="table" aria-label="近邻查询结果">
      <div className="nearby-table-grid nearby-table-head" role="row">
        <span role="columnheader" className="nearby-select-all-cell">
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allChecked}
            aria-label="全选近邻查询结果"
            onChange={(event) => onToggleAll(event.target.checked)}
          />
          <span>上图</span>
        </span>
        <span role="columnheader">目标 ID</span>
        <span role="columnheader">名称</span>
        <span role="columnheader">类别</span>
        <span role="columnheader">距离（km）</span>
        <span role="columnheader">经度</span>
        <span role="columnheader">纬度</span>
      </div>
      {rows.length > 0 ? (
        <div
          className="nearby-virtual-viewport"
          style={{ height: VIRTUAL_VIEWPORT_HEIGHT }}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
          <div className="nearby-virtual-content" style={{ height: totalHeight }}>
            {visibleRows.map((target, index) => {
              const rowIndex = startIndex + index;
              return (
                <div
                  className="nearby-table-grid nearby-table-row"
                  key={target.id}
                  role="row"
                  style={{
                    top: rowIndex * VIRTUAL_ROW_HEIGHT,
                    height: VIRTUAL_ROW_HEIGHT,
                  }}
                >
                  <span role="cell">
                    <input
                      type="checkbox"
                      checked={checkedIds.has(target.id)}
                      aria-label={`将${target.name}上图`}
                      onChange={(event) =>
                        onToggleTarget(target, event.target.checked)
                      }
                    />
                  </span>
                  <span role="cell">{target.id}</span>
                  <span role="cell">{target.name}</span>
                  <span role="cell">{target.categoryName}</span>
                  <span role="cell">{target.distanceKm.toFixed(3)}</span>
                  <span role="cell">{target.longitude.toFixed(6)}</span>
                  <span role="cell">{target.latitude.toFixed(6)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="nearby-empty" role="row">
          没有符合条件的目标。
        </div>
      )}
    </div>
  );
}

export default function NearbyPanel({
  checkedIds,
  queryResult,
  error,
  pickedPoint,
  pickMode,
  onClose,
  onQuery,
  onToggleAll,
  onTogglePickMode,
  onToggleTarget,
}) {
  const [form, setForm] = useState(INITIAL_FORM);
  const { dragStyle, handlePointerDown } = useDraggable();

  useEffect(() => {
    if (!pickedPoint) {
      return;
    }
    setForm((current) => ({
      ...current,
      longitude: String(pickedPoint.longitude),
      latitude: String(pickedPoint.latitude),
    }));
  }, [pickedPoint]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    const longitude = Number(form.longitude);
    const latitude = Number(form.latitude);
    const limit = Number(form.limit);
    const radiusKm = Number(form.radiusKm);
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      onQuery(null, "经度范围必须是 -180 到 180。");
      return;
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      onQuery(null, "纬度范围必须是 -90 到 90。");
      return;
    }
    if (form.queryType === "nearest" && (!Number.isInteger(limit) || limit <= 0)) {
      onQuery(null, "K 必须是大于 0 的整数。");
      return;
    }
    if (form.queryType === "within" && (!Number.isFinite(radiusKm) || radiusKm <= 0)) {
      onQuery(null, "距离 M 必须是大于 0 的数字。");
      return;
    }

    onQuery(
      {
        point: { longitude, latitude },
        queryType: form.queryType,
        limit,
        radiusKm,
        method: form.method,
      },
      "",
    );
  }

  return (
    <aside className="nearby-panel" aria-label="近邻查询" style={dragStyle}>
      <header className="nearby-panel-header" onPointerDown={handlePointerDown}>
        <div>
          <h2>近邻查询</h2>
          <p>计算某个点的 K 个近邻或 M 距离内目标</p>
        </div>
        <button
          className="panel-close-button"
          type="button"
          aria-label="关闭近邻查询"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <form className="nearby-form" onSubmit={submit}>
        <label>
          <span>查询点经度</span>
          <input
            type="number"
            step="any"
            value={form.longitude}
            onChange={(event) => updateField("longitude", event.target.value)}
          />
        </label>
        <label>
          <span>查询点纬度</span>
          <input
            type="number"
            step="any"
            value={form.latitude}
            onChange={(event) => updateField("latitude", event.target.value)}
          />
        </label>
        <button
          className={`nearby-pick-button ${pickMode ? "is-active" : ""}`}
          type="button"
          onClick={() => onTogglePickMode(!pickMode)}
        >
          {pickMode ? "请点击地图选择位置" : "在地图上选点"}
        </button>
        <label>
          <span>查询方式</span>
          <select
            value={form.queryType}
            onChange={(event) => updateField("queryType", event.target.value)}
          >
            <option value="nearest">最近 K 个点</option>
            <option value="within">M 距离内</option>
          </select>
        </label>
        {form.queryType === "nearest" ? (
          <label>
            <span>K 个点</span>
            <input
              type="number"
              min="1"
              step="1"
              value={form.limit}
              onChange={(event) => updateField("limit", event.target.value)}
            />
          </label>
        ) : (
          <label>
            <span>距离 M（km）</span>
            <input
              type="number"
              min="0.001"
              step="any"
              value={form.radiusKm}
              onChange={(event) => updateField("radiusKm", event.target.value)}
            />
          </label>
        )}
        <label className="nearby-method-field">
          <span>计算方法</span>
          <select
            value={form.method}
            onChange={(event) => updateField("method", event.target.value)}
          >
            <option value="full-scan">方法一：全量遍历</option>
            <option value="spatial-hash">方法二：Spatial Hash</option>
          </select>
        </label>
        <button className="nearby-query-button" type="submit">
          开始查询
        </button>
      </form>

      {form.method === "spatial-hash" && (
        <p className="nearby-method-tip">
          Spatial Hash 使用固定 {SPATIAL_HASH_CELL_KM} km 网格，仅查询周围候选 Cell。
        </p>
      )}
      {error && <p className="nearby-error">{error}</p>}

      {queryResult && (
        <>
          <div className="nearby-result-summary">
            <strong>
              查询到 {queryResult.rows.length} 个目标
            </strong>
            <span>
              {queryResult.methodLabel} · 候选 {queryResult.candidateCount} 个 · 扫描 {queryResult.scannedCells} 个目标/Cell · {queryResult.elapsedMs} ms
            </span>
          </div>
          <VirtualResultTable
            checkedIds={checkedIds}
            rows={queryResult.rows}
            onToggleAll={onToggleAll}
            onToggleTarget={onToggleTarget}
          />
        </>
      )}
    </aside>
  );
}
