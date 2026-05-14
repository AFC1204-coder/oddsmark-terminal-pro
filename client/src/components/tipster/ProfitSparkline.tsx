/** Mini sparkline chart showing cumulative profit history */
export function ProfitSparkline({ data, width = 64, height = 24 }: {
  data: number[];
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;

  let min = data[0], max = data[0];
  for (let i = 1; i < data.length; i++) {
    if (data[i] < min) min = data[i];
    if (data[i] > max) max = data[i];
  }
  const range = max - min || 1;
  const padding = 2;
  const w = width - padding * 2;
  const h = height - padding * 2;

  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * w;
    const y = padding + h - ((val - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");

  const lastVal = data[data.length - 1];
  const isPositive = lastVal >= 0;
  const strokeColor = isPositive ? "#34d399" : "#f87171";
  const fillColor = isPositive ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)";

  // Create area fill path
  const firstPoint = points.split(" ")[0];
  const lastPoint = points.split(" ").pop()!;
  const areaPath = `M ${firstPoint} L ${points.replace(/ /g, " L ")} L ${lastPoint.split(",")[0]},${height - padding} L ${firstPoint.split(",")[0]},${height - padding} Z`;

  return (
    <svg width={width} height={height} className="shrink-0">
      <path d={areaPath} fill={fillColor} />
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
