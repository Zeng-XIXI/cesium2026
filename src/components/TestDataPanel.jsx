import { useState } from "react";
import useDraggable from "../hooks/useDraggable.js";

const INITIAL_FORM = {
  categoryName: "测试目标",
  count: "100",
  longitudeMin: "100",
  longitudeMax: "120",
  latitudeMin: "20",
  latitudeMax: "40",
  color: "#38bdf8",
};

export default function TestDataPanel({ onClose, onGenerate }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState("");
  const { dragStyle, handlePointerDown } = useDraggable();

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function submit(event) {
    event.preventDefault();
    const count = Number(form.count);
    const longitudeMin = Number(form.longitudeMin);
    const longitudeMax = Number(form.longitudeMax);
    const latitudeMin = Number(form.latitudeMin);
    const latitudeMax = Number(form.latitudeMax);

    if (!form.categoryName.trim()) {
      setError("请输入目标类别名称。");
      return;
    }
    if (!Number.isInteger(count) || count <= 0) {
      setError("数据个数必须是大于 0 的整数。");
      return;
    }
    if (
      !Number.isFinite(longitudeMin) ||
      !Number.isFinite(longitudeMax) ||
      longitudeMin < -180 ||
      longitudeMax > 180 ||
      longitudeMin > longitudeMax
    ) {
      setError("经度范围必须在 -180 到 180 之间，且最小值不能大于最大值。");
      return;
    }
    if (
      !Number.isFinite(latitudeMin) ||
      !Number.isFinite(latitudeMax) ||
      latitudeMin < -90 ||
      latitudeMax > 90 ||
      latitudeMin > latitudeMax
    ) {
      setError("纬度范围必须在 -90 到 90 之间，且最小值不能大于最大值。");
      return;
    }

    onGenerate({
      categoryName: form.categoryName.trim(),
      count,
      longitudeMin,
      longitudeMax,
      latitudeMin,
      latitudeMax,
      color: form.color,
    });
    setError("");
  }

  return (
    <aside className="test-data-panel" aria-label="添加测试数据" style={dragStyle}>
      <header className="test-data-panel-header" onPointerDown={handlePointerDown}>
        <div>
          <h2>添加测试数据</h2>
          <p>随机生成目标并纳入目标数据列表</p>
        </div>
        <button
          className="panel-close-button"
          type="button"
          aria-label="关闭添加测试数据"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <form className="test-data-form" onSubmit={submit}>
        <label>
          <span>目标类别</span>
          <input
            type="text"
            value={form.categoryName}
            placeholder="例如：测试机场"
            onChange={(event) => updateField("categoryName", event.target.value)}
          />
        </label>
        <label>
          <span>数据个数</span>
          <input
            type="number"
            min="1"
            step="1"
            value={form.count}
            onChange={(event) => updateField("count", event.target.value)}
          />
        </label>
        <label>
          <span>颜色</span>
          <input
            className="test-data-color-input"
            type="color"
            value={form.color}
            onChange={(event) => updateField("color", event.target.value)}
          />
        </label>
        <label>
          <span>经度最小值</span>
          <input
            type="number"
            min="-180"
            max="180"
            step="any"
            value={form.longitudeMin}
            onChange={(event) => updateField("longitudeMin", event.target.value)}
          />
        </label>
        <label>
          <span>经度最大值</span>
          <input
            type="number"
            min="-180"
            max="180"
            step="any"
            value={form.longitudeMax}
            onChange={(event) => updateField("longitudeMax", event.target.value)}
          />
        </label>
        <label>
          <span>纬度最小值</span>
          <input
            type="number"
            min="-90"
            max="90"
            step="any"
            value={form.latitudeMin}
            onChange={(event) => updateField("latitudeMin", event.target.value)}
          />
        </label>
        <label>
          <span>纬度最大值</span>
          <input
            type="number"
            min="-90"
            max="90"
            step="any"
            value={form.latitudeMax}
            onChange={(event) => updateField("latitudeMax", event.target.value)}
          />
        </label>
        {error && <p className="test-data-error">{error}</p>}
        <p className="test-data-tip">
          生成目标默认不勾选；如果类别名称已存在，会自动归入现有类别。
        </p>
        <button className="test-data-submit" type="submit">
          生成并加入目标数据
        </button>
      </form>
    </aside>
  );
}
