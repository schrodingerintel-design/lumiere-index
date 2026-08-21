export function Sparkline({
  data,
  color = "currentColor",
  className = "",
}: {
  data: number[];
  color?: string;
  className?: string;
}) {
  if (!data.length) return null;
  const w = 80,
    h = 24;
  const min = Math.min(...data),
    max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1 || 1);
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
