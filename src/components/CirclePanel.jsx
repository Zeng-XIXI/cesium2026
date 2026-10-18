import { useEffect, useRef, useState } from "react";
import useDraggable from "../hooks/useDraggable.js";

const INITIAL_FORM = {
  radius: "100",
  longitude: "104",
  latitude: "35",
  color: "#38bdf8",
};

export default function CirclePanel({
  circles,
  selectedCircleId,
  pickedPoint,
  pickMode,
  onClose,
  onCreate,
  onTogglePickMode,
  onToggleCircle,
  onToggleAll,
  onLocate,
  onDelete,
  onSelectCircle,
}) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState("");
  const masterCheckboxRef = useRef(null);
  const { dragStyle, handlePointerDown } = useDraggable();
  const visibleCount = circles.filter((circle) => circle.visible).length;
  const allVisible = circles.length > 0 && visibleCount === circles.length;

  useEffect(() => {
    if (masterCheckboxRef.current) {
      masterCheckboxRef.current.indeterminate =
        visibleCount > 0 && visibleCount < circles.length;
    }
  }, [circles.length, visibleCount]);

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
    setError("");
  }

  function submit(event) {
    event.preventDefault();
    const radius = Number(form.radius);
    const longitude = Number(form.longitude);
    const latitude = Number(form.latitude);
    if (!Number.isFinite(radius) || radius <= 0) {
      setError("半径必须是大于 0 的数字。");
      return;
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setError("经度范围必须是 -180 到 180。");
      return;
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      setError("纬度范围必须是 -90 到 90。");
      return;
    }

    onCreate({ radius, longitude, latitude, color: form.color });
    setError("");
  }

  return (
    <aside
      className="circle-panel"
      aria-label="圆形标绘"
      style={dragStyle}
    >
      <header className="circle-panel-header" onPointerDown={handlePointerDown}>
        <div>
          <h2>圆形标绘</h2>
          <p>拖动标题栏移动，拖动右下角调整大小</p>
        </div>
        <button
          className="panel-close-button"
          type="button"
          aria-label="关闭圆形标绘"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <form className="circle-form" onSubmit={submit}>
        <label>
          <span>半径（km）</span>
          <input
            type="number"
            min="0.001"
            step="any"
            value={form.radius}
            onChange={(event) => updateField("radius", event.target.value)}
          />
        </label>
        <label>
          <span>经度</span>
          <input
            type="number"
            min="-180"
            max="180"
            step="any"
            value={form.longitude}
            onChange={(event) => updateField("longitude", event.target.value)}
          />
        </label>
        <label>
          <span>纬度</span>
          <input
            type="number"
            min="-90"
            max="90"
            step="any"
            value={form.latitude}
            onChange={(event) => updateField("latitude", event.target.value)}
          />
        </label>
        <label className="circle-color-input">
          <span>颜色</span>
          <input
            type="color"
            value={form.color}
            onChange={(event) => updateField("color", event.target.value)}
          />
        </label>
        <button
          className={`circle-pick-button ${pickMode ? "is-active" : ""}`}
          type="button"
          onClick={() => onTogglePickMode(!pickMode)}
        >
          {pickMode ? "请点击地图选择位置" : "在地图上选点"}
        </button>
        {error && <p className="circle-form-error">{error}</p>}
        <button className="circle-confirm-button" type="submit">
          确认绘制
        </button>
      </form>

      <div className="circle-list-header">
        <strong>圆圈列表</strong>
        <span>{visibleCount} / {circles.length} 个显示</span>
      </div>
      <div className="circle-table-wrapper">
        <table className="circle-table">
          <thead>
            <tr>
              <th>
                <input
                  ref={masterCheckboxRef}
                  type="checkbox"
                  checked={allVisible}
                  aria-label="显示全部圆圈"
                  onChange={(event) => onToggleAll(event.target.checked)}
                />
              </th>
              <th>ID</th>
              <th>经纬度</th>
              <th>半径</th>
              <th>颜色</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {circles.length === 0 ? (
              <tr>
                <td className="circle-empty" colSpan="6">
                  暂无圆圈，请先填写参数并确认绘制。
                </td>
              </tr>
            ) : (
              circles.map((circle) => (
                <tr
                  className={selectedCircleId === circle.id ? "is-selected" : ""}
                  key={circle.id}
                  onClick={() => onSelectCircle(circle.id)}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={circle.visible}
                      aria-label={`显示${circle.id}`}
                      onChange={(event) =>
                        onToggleCircle(circle.id, event.target.checked)
                      }
                      onClick={(event) => event.stopPropagation()}
                    />
                  </td>
                  <td>{circle.id}</td>
                  <td>
                    {circle.longitude.toFixed(4)}, {circle.latitude.toFixed(4)}
                  </td>
                  <td>{circle.radius.toFixed(2)} km</td>
                  <td>
                    <span className="circle-color-cell">
                      <span
                        className="circle-color-swatch"
                        style={{ backgroundColor: circle.color }}
                        title={circle.color}
                      />
                      <span>{circle.color}</span>
                    </span>
                  </td>
                  <td className="circle-row-actions">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onLocate(circle);
                      }}
                    >
                      定位
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(circle.id);
                      }}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </aside>
  );
}
