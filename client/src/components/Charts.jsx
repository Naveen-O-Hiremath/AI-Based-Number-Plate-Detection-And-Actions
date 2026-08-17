import { useMemo, useRef, useState } from 'react';

// Hand-rolled SVG charts for the dark console theme — no chart library.
// Text wears text tokens; series color only appears on marks.

const CHART_TEXT = 'var(--text-dim)';
const CHART_FAINT = 'var(--text-faint)';
const GRID = 'rgba(148, 163, 184, 0.12)';

export function TrendChart({ data, color = '#3b82f6', height = 180, valueLabel = 'detections' }) {
    const wrapRef = useRef(null);
    const [hover, setHover] = useState(null);
    const W = 720;
    const H = height;
    const PAD = { top: 16, right: 56, bottom: 26, left: 44 };

    const { points, max, path, areaPath } = useMemo(() => {
        if (!data.length) return { points: [], max: 0, path: '', areaPath: '' };
        const max = Math.max(...data.map((d) => d.count)) || 1;
        const innerW = W - PAD.left - PAD.right;
        const innerH = H - PAD.top - PAD.bottom;
        const points = data.map((d, i) => ({
            x: PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW),
            y: PAD.top + innerH - (d.count / max) * innerH,
            ...d,
        }));
        const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        const baseline = PAD.top + innerH;
        const areaPath = `${path} L${points[points.length - 1].x.toFixed(1)},${baseline} L${points[0].x.toFixed(1)},${baseline} Z`;
        return { points, max, path, areaPath };
    }, [data, H]);

    if (!data.length) return <div className="empty-state">No data yet.</div>;

    const last = points[points.length - 1];
    const gridLines = [0.25, 0.5, 0.75, 1].map((f) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - f));

    function handleMove(e) {
        const rect = wrapRef.current?.getBoundingClientRect();
        if (!rect) return;
        const px = ((e.clientX - rect.left) / rect.width) * W;
        let nearest = 0;
        let best = Infinity;
        points.forEach((p, i) => {
            const d = Math.abs(p.x - px);
            if (d < best) { best = d; nearest = i; }
        });
        setHover(nearest);
    }

    const hp = hover != null ? points[hover] : null;

    return (
        <div ref={wrapRef} style={{ position: 'relative' }} onMouseMove={handleMove} onMouseLeave={() => setHover(null)}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', fontVariantNumeric: 'tabular-nums' }}>
                {gridLines.map((y, i) => (
                    <line key={i} x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke={GRID} strokeWidth="1" />
                ))}
                <text x={PAD.left - 8} y={PAD.top + 4} textAnchor="end" fontSize="10" fill={CHART_FAINT}>{max.toLocaleString()}</text>
                <text x={PAD.left - 8} y={H - PAD.bottom + 4} textAnchor="end" fontSize="10" fill={CHART_FAINT}>0</text>

                <path d={areaPath} fill={color} opacity="0.14" />
                <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

                {hp && (
                    <line x1={hp.x} x2={hp.x} y1={PAD.top} y2={H - PAD.bottom} stroke={CHART_FAINT} strokeWidth="1" strokeDasharray="3 3" />
                )}
                {hp && <circle cx={hp.x} cy={hp.y} r="4.5" fill={color} stroke="var(--bg-card)" strokeWidth="2" />}

                <circle cx={last.x} cy={last.y} r="4" fill={color} stroke="var(--bg-card)" strokeWidth="2" />
                <text x={last.x + 8} y={last.y + 4} fontSize="11" fontWeight="600" fill={CHART_TEXT}>
                    {last.count.toLocaleString()}
                </text>

                <text x={points[0].x} y={H - 8} fontSize="10" fill={CHART_FAINT}>{points[0].day.slice(5)}</text>
                <text x={points[Math.floor(points.length / 2)].x} y={H - 8} textAnchor="middle" fontSize="10" fill={CHART_FAINT}>
                    {points[Math.floor(points.length / 2)].day.slice(5)}
                </text>
                <text x={last.x} y={H - 8} textAnchor="end" fontSize="10" fill={CHART_FAINT}>{last.day.slice(5)}</text>
            </svg>
            {hp && (
                <div style={{
                    position: 'absolute',
                    left: `${(hp.x / W) * 100}%`,
                    top: 0,
                    transform: `translateX(${hover > points.length / 2 ? '-108%' : '8%'})`,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '6px 10px',
                    fontSize: 12,
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                }}>
                    <div style={{ color: CHART_FAINT, fontSize: 10.5 }}>{hp.day}</div>
                    <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{hp.count.toLocaleString()} {valueLabel}</div>
                </div>
            )}
        </div>
    );
}

// Horizontal labeled bars — identity lives in the row label, so color can be a
// single hue (categorical rows) or an ordered ramp (severity).
export function BarRows({ data, height = 26 }) {
    const [hover, setHover] = useState(null);
    if (!data.length) return <div className="empty-state">No data yet.</div>;
    const max = Math.max(...data.map((d) => d.value)) || 1;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.map((d, i) => {
                const frac = d.value / max;
                return (
                    <div
                        key={d.label}
                        style={{ display: 'grid', gridTemplateColumns: '92px 1fr 64px', alignItems: 'center', gap: 10 }}
                        onMouseEnter={() => setHover(i)}
                        onMouseLeave={() => setHover(null)}
                    >
                        <span style={{ fontSize: 12, color: CHART_TEXT, textTransform: 'capitalize', textAlign: 'right' }}>{d.label}</span>
                        <div style={{ background: GRID, borderRadius: 4, height, position: 'relative', overflow: 'hidden' }}>
                            <div style={{
                                width: `${Math.max(frac * 100, 1)}%`,
                                height: '100%',
                                background: d.color,
                                borderRadius: '0 4px 4px 0',
                                opacity: hover === null || hover === i ? 1 : 0.55,
                                transition: 'opacity 120ms',
                            }} />
                        </div>
                        <span style={{ fontSize: 12.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                            {d.value.toLocaleString()}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
