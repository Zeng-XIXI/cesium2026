export default function TargetTable({ rows }) {
  return (
    <div className="chat-table-wrapper">
      <table className="chat-target-table">
        <thead>
          <tr>
            <th>目标 ID</th>
            <th>目标名称</th>
            <th>经度</th>
            <th>纬度</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.id}</td>
              <td>{row.name || "-"}</td>
              <td>{Number(row.longitude).toFixed(6)}</td>
              <td>{Number(row.latitude).toFixed(6)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
