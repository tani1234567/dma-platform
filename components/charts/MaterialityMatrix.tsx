"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as d3 from "d3";
import { GRITopic, QuadrantType, TopicScore } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const MARGIN   = { top: 40, right: 40, bottom: 60, left: 60 } as const;
const DEF_W    = 700;
const DEF_H    = 600;
const TIP_W    = 224;
const TIP_H    = 174;
const Q_OPACITY = 0.06;

const PILLAR_FILL: Record<string, string> = {
  E: "#16a34a",
  S: "#2563eb",
  G: "#ea580c",
};

const QUADRANT_FILL: Record<string, string> = {
  critical:  "#ef4444",
  important: "#f97316",
  consider:  "#3b82f6",
  monitor:   "#9ca3af",
};

const QUADRANT_BADGE: Record<QuadrantType, { label: string; bg: string; color: string }> = {
  critical:  { label: "Critical",  bg: "#fee2e2", color: "#991b1b" },
  important: { label: "Important", bg: "#ffedd5", color: "#9a3412" },
  consider:  { label: "Consider",  bg: "#dbeafe", color: "#1e40af" },
  monitor:   { label: "Monitor",   bg: "#f3f4f6", color: "#6b7280" },
};

// ─── Local types ──────────────────────────────────────────────────────────────

interface DotDatum {
  code: string;
  impactScore: number;
  financialScore: number;
  combinedScore: number;
  quadrant: QuadrantType;
  respondentCount: number;
  topicName: string;
  pillarCode: string;
}

interface TooltipState {
  datum: DotDatum;
  svgX: number;
  svgY: number;
}

export interface MaterialityMatrixProps {
  topicScores: Record<string, TopicScore>;
  topics: GRITopic[];
  impactThreshold?: number;
  financialThreshold?: number;
  width?: number;
  height?: number;
  onTopicClick?: (topicCode: string) => void;
  onThresholdChange?: (impact: number, financial: number) => void;
}

// ─── Tooltip overlay ─────────────────────────────────────────────────────────

function TooltipCard({
  datum, svgX, svgY, svgW, svgH,
}: {
  datum: DotDatum; svgX: number; svgY: number; svgW: number; svgH: number;
}) {
  const q     = QUADRANT_BADGE[datum.quadrant];
  const flipX = svgX + TIP_W + 16 > svgW;
  const flipY = svgY + TIP_H     > svgH;

  return (
    <div
      className="absolute z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 pointer-events-none"
      style={{
        left:   flipX ? svgX - TIP_W - 12 : svgX + 12,
        top:    flipY ? svgY - TIP_H + 10  : svgY - 10,
        minWidth: TIP_W,
      }}
    >
      <p className="text-xs font-bold text-gray-900">{datum.code}</p>
      <p className="text-[11px] text-gray-500 mb-2 leading-snug line-clamp-2">
        {datum.topicName}
      </p>
      <div className="space-y-0.5 mb-2">
        {(
          [
            { label: "Impact Score",    value: datum.impactScore },
            { label: "Financial Score", value: datum.financialScore },
            { label: "Combined",        value: datum.combinedScore, bold: true },
          ] as { label: string; value: number; bold?: boolean }[]
        ).map(({ label, value, bold }) => (
          <div key={label} className="flex justify-between text-[11px]">
            <span className="text-gray-500">{label}</span>
            <span className={bold ? "font-bold text-gray-900" : "font-semibold text-gray-900"}>
              {value.toFixed(2)}
            </span>
          </div>
        ))}
        <div className="flex justify-between text-[11px]">
          <span className="text-gray-500">Respondents</span>
          <span className="text-gray-700">{datum.respondentCount}</span>
        </div>
      </div>
      <span
        className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
        style={{ backgroundColor: q.bg, color: q.color }}
      >
        {q.label}
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const MaterialityMatrix = forwardRef<SVGSVGElement, MaterialityMatrixProps>(
  function MaterialityMatrix(
    {
      topicScores,
      topics,
      impactThreshold    = 3.0,
      financialThreshold = 3.0,
      width  = DEF_W,
      height = DEF_H,
      onTopicClick,
      onThresholdChange,
    },
    ref
  ) {
    const svgRef = useRef<SVGSVGElement>(null);
    useImperativeHandle(ref, () => svgRef.current!, []);

    const [localImpact,    setLocalImpact]    = useState(impactThreshold);
    const [localFinancial, setLocalFinancial] = useState(financialThreshold);
    const [tooltip, setTooltip] = useState<TooltipState | null>(null);

    // Stable callback ref — keeps D3 effect dependency-stable
    const onClickRef = useRef(onTopicClick);
    useEffect(() => { onClickRef.current = onTopicClick; }, [onTopicClick]);

    // Sync prop changes from parent (e.g., initial load)
    useEffect(() => { setLocalImpact(impactThreshold); },    [impactThreshold]);
    useEffect(() => { setLocalFinancial(financialThreshold); }, [financialThreshold]);

    // ── D3 drawing ───────────────────────────────────────────────────────────

    useEffect(() => {
      const svgEl = svgRef.current;
      if (!svgEl) return;

      const svg = d3.select(svgEl);
      svg.selectAll("*").remove();

      const innerW = width  - MARGIN.left - MARGIN.right;
      const innerH = height - MARGIN.top  - MARGIN.bottom;

      const xScale = d3.scaleLinear().domain([1, 5]).range([0, innerW]);
      const yScale = d3.scaleLinear().domain([1, 5]).range([innerH, 0]);
      const rScale = d3.scaleLinear().domain([1, 5]).range([8, 14]).clamp(true);

      const g = svg
        .append("g")
        .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

      const ftX = xScale(localFinancial);
      const itY = yScale(localImpact);

      // ── Quadrant backgrounds ───────────────────────────────────────────────

      [
        { key: "monitor",   x: 0,   y: itY, w: ftX,          h: innerH - itY },
        { key: "consider",  x: ftX, y: itY, w: innerW - ftX, h: innerH - itY },
        { key: "important", x: 0,   y: 0,   w: ftX,          h: itY },
        { key: "critical",  x: ftX, y: 0,   w: innerW - ftX, h: itY },
      ].forEach(({ key, x, y, w, h }) =>
        g.append("rect")
          .attr("x", x).attr("y", y)
          .attr("width", Math.max(0, w))
          .attr("height", Math.max(0, h))
          .attr("fill", QUADRANT_FILL[key])
          .attr("opacity", Q_OPACITY)
      );

      // ── Quadrant labels ────────────────────────────────────────────────────

      [
        { text: "CRITICAL",  x: innerW - 5, y: 15,          anchor: "end" },
        { text: "IMPORTANT", x: 5,          y: 15,          anchor: "start" },
        { text: "CONSIDER",  x: innerW - 5, y: innerH - 8,  anchor: "end" },
        { text: "MONITOR",   x: 5,          y: innerH - 8,  anchor: "start" },
      ].forEach(({ text, x, y, anchor }) =>
        g.append("text")
          .attr("x", x).attr("y", y)
          .attr("text-anchor", anchor)
          .attr("fill", "#9ca3af")
          .attr("font-size", "9")
          .attr("font-weight", "700")
          .attr("letter-spacing", "0.1em")
          .attr("pointer-events", "none")
          .text(text)
      );

      // ── Grid lines ─────────────────────────────────────────────────────────

      [1, 2, 3, 4, 5].forEach(v => {
        g.append("line")
          .attr("x1", xScale(v)).attr("x2", xScale(v))
          .attr("y1", 0).attr("y2", innerH)
          .attr("stroke", "#f3f4f6").attr("stroke-width", 1);
        g.append("line")
          .attr("x1", 0).attr("x2", innerW)
          .attr("y1", yScale(v)).attr("y2", yScale(v))
          .attr("stroke", "#f3f4f6").attr("stroke-width", 1);
      });

      // ── Axes ───────────────────────────────────────────────────────────────

      const fmt = d3.format("d");

      g.append("g")
        .attr("transform", `translate(0,${innerH})`)
        .call(d3.axisBottom(xScale).ticks(5).tickFormat(d => fmt(d as number)))
        .call(ag => {
          ag.selectAll<SVGTextElement, unknown>("text")
            .attr("fill", "#9ca3af").attr("font-size", "11");
          ag.selectAll<SVGLineElement | SVGPathElement, unknown>(".domain, line")
            .attr("stroke", "#e5e7eb");
        });

      g.append("g")
        .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => fmt(d as number)))
        .call(ag => {
          ag.selectAll<SVGTextElement, unknown>("text")
            .attr("fill", "#9ca3af").attr("font-size", "11");
          ag.selectAll<SVGLineElement | SVGPathElement, unknown>(".domain, line")
            .attr("stroke", "#e5e7eb");
        });

      // Axis labels
      g.append("text")
        .attr("x", innerW / 2).attr("y", innerH + 48)
        .attr("text-anchor", "middle")
        .attr("fill", "#6b7280").attr("font-size", "12")
        .text("Financial Materiality Score →");

      g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -(innerH / 2)).attr("y", -48)
        .attr("text-anchor", "middle")
        .attr("fill", "#6b7280").attr("font-size", "12")
        .text("↑ Impact Materiality Score");

      // ── Threshold lines ────────────────────────────────────────────────────

      g.append("line")
        .attr("x1", ftX).attr("x2", ftX)
        .attr("y1", 0).attr("y2", innerH)
        .attr("stroke", "#333a8b").attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "6,4").attr("opacity", 0.55);

      g.append("line")
        .attr("x1", 0).attr("x2", innerW)
        .attr("y1", itY).attr("y2", itY)
        .attr("stroke", "#333a8b").attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "6,4").attr("opacity", 0.55);

      // ── Build dot data ─────────────────────────────────────────────────────

      const topicByCode = new Map(topics.map(t => [t.code, t]));
      const data: DotDatum[] = Object.entries(topicScores).map(([code, s]) => ({
        code,
        impactScore:     s.impactScore,
        financialScore:  s.financialScore,
        combinedScore:   s.combinedScore,
        quadrant:        s.quadrant,
        respondentCount: s.respondentCount,
        topicName:       topicByCode.get(code)?.name ?? code,
        pillarCode:      code[0] ?? "E",
      }));

      // ── Topic code labels (rendered before dots so dots sit on top) ────────

      data.forEach(d => {
        const cx = xScale(d.financialScore);
        const cy = yScale(d.impactScore);
        const r  = rScale(d.combinedScore);
        const isRight = d.financialScore > 3;

        g.append("text")
          .attr("x", isRight ? cx - r - 4 : cx + r + 4)
          .attr("y", cy + 4)
          .attr("text-anchor", isRight ? "end" : "start")
          .attr("fill", "#9ca3af").attr("font-size", "10")
          .attr("pointer-events", "none")
          .text(d.code);
      });

      // ── Dots with interactions ─────────────────────────────────────────────

      data.forEach(d => {
        const cx   = xScale(d.financialScore);
        const cy   = yScale(d.impactScore);
        const r    = rScale(d.combinedScore);
        const fill = PILLAR_FILL[d.pillarCode] ?? PILLAR_FILL["E"];

        const circle = g.append("circle")
          .attr("cx", cx).attr("cy", cy)
          .attr("r", r)
          .attr("fill", fill)
          .attr("stroke", "white").attr("stroke-width", 2)
          .attr("cursor", "pointer");

        circle
          .on("mouseover", () => {
            setTooltip({
              datum: d,
              svgX: cx + MARGIN.left,
              svgY: cy + MARGIN.top,
            });
            circle.raise()
              .transition().duration(150)
              .attr("r", r * 1.4)
              .attr("stroke", "#333a8b")
              .attr("stroke-width", 3);
          })
          .on("mouseout", () => {
            setTooltip(null);
            circle.transition().duration(150)
              .attr("r", r)
              .attr("stroke", "white")
              .attr("stroke-width", 2);
          })
          .on("click", () => { onClickRef.current?.(d.code); });
      });

      return () => { svg.selectAll("*").remove(); };
    }, [topicScores, topics, localImpact, localFinancial, width, height]);

    // ── Slider handlers ──────────────────────────────────────────────────────

    function handleImpact(v: number) {
      setLocalImpact(v);
      setTooltip(null);
      onThresholdChange?.(v, localFinancial);
    }

    function handleFinancial(v: number) {
      setLocalFinancial(v);
      setTooltip(null);
      onThresholdChange?.(localImpact, v);
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
      <div>
        {/* SVG + tooltip overlay */}
        <div className="relative overflow-x-auto" style={{ minHeight: height }}>
          <svg
            ref={svgRef}
            width={width}
            height={height}
            style={{ display: "block" }}
          />
          {tooltip && (
            <TooltipCard
              datum={tooltip.datum}
              svgX={tooltip.svgX}
              svgY={tooltip.svgY}
              svgW={width}
              svgH={height}
            />
          )}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 px-1">
          <div className="flex items-center gap-4">
            {(
              [
                { label: "Environmental", fill: PILLAR_FILL["E"] },
                { label: "Social",        fill: PILLAR_FILL["S"] },
                { label: "Governance",    fill: PILLAR_FILL["G"] },
              ]
            ).map(({ label, fill }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: fill }}
                />
                <span className="text-xs text-gray-600">{label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="24" height="10" aria-hidden="true">
              <line
                x1="0" y1="5" x2="24" y2="5"
                stroke="#333a8b" strokeWidth="1.5"
                strokeDasharray="5,3" opacity="0.55"
              />
            </svg>
            <span className="text-xs text-gray-600">Threshold</span>
          </div>
        </div>

        {/* Threshold sliders */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-5 px-1">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">
              Impact Threshold:{" "}
              <span className="text-[#333a8b] font-bold tabular-nums">
                {localImpact.toFixed(1)}
              </span>
            </label>
            <input
              type="range"
              min="1" max="5" step="0.1"
              value={localImpact}
              onChange={e => handleImpact(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[#333a8b]"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>1</span><span>3</span><span>5</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">
              Financial Threshold:{" "}
              <span className="text-[#333a8b] font-bold tabular-nums">
                {localFinancial.toFixed(1)}
              </span>
            </label>
            <input
              type="range"
              min="1" max="5" step="0.1"
              value={localFinancial}
              onChange={e => handleFinancial(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[#333a8b]"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>1</span><span>3</span><span>5</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

MaterialityMatrix.displayName = "MaterialityMatrix";
export default MaterialityMatrix;
