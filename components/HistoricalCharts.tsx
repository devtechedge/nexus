"use client";

import React, { useMemo } from "react";
import { TelemetryLog } from "@/lib/db";
import { TrendingUp, TrendingDown, ArrowRightLeft, DollarSign, Server, Clock } from "lucide-react";

interface HistoricalChartsProps {
  logsHistory: TelemetryLog[];
}

export const HistoricalCharts: React.FC<HistoricalChartsProps> = ({ logsHistory }) => {
  // Use a stable copy of logs in chronologic order (oldest first for line chart)
  const chronologicalLogs = useMemo(() => {
    return [...logsHistory].reverse().slice(-50); // last 50 data points
  }, [logsHistory]);

  // Compute stats for sparklines and tickers
  const marketMetrics = useMemo(() => {
    if (logsHistory.length < 2) {
      return {
        BTC: { price: 95420, change: 0.15 },
        ETH: { price: 3220, change: -0.4 },
        SOL: { price: 182.4, change: 1.2 },
        AAPL: { price: 241.5, change: -0.05 },
      };
    }

    const current = logsHistory[0].market;
    const previous = logsHistory[1].market;

    const calcChange = (cur: number, prev: number) => {
      if (prev === 0) return 0;
      return parseFloat((((cur - prev) / prev) * 100).toFixed(2));
    };

    return {
      BTC: { price: current.BTC, change: calcChange(current.BTC, previous.BTC) },
      ETH: { price: current.ETH, change: calcChange(current.ETH, previous.ETH) },
      SOL: { price: current.SOL, change: calcChange(current.SOL, previous.SOL) },
      AAPL: { price: current.AAPL, change: calcChange(current.AAPL, previous.AAPL) },
    };
  }, [logsHistory]);

  // --- SVG Math Utility helpers ---
  // Renders a high-performance custom SVG Area and Path for rolling hardware metrics
  const hardwareChartPaths = useMemo(() => {
    const data = chronologicalLogs;
    if (data.length < 2) return { cpuPath: "", cpuArea: "", tempPath: "", tempArea: "", gridLines: [] };

    const width = 800;
    const height = 180;
    const padding = { top: 15, right: 15, bottom: 20, left: 40 };

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Get max bounds for y (CPU is always 0-100, Temp is usually 30-70)
    const yMax = 100;
    const yMin = 0;

    const getX = (index: number) => padding.left + (index / (data.length - 1)) * chartW;
    const getY = (value: number) => padding.top + chartH - ((value - yMin) / (yMax - yMin)) * chartH;

    let cpuPoints = "";
    let tempPoints = "";

    data.forEach((log, index) => {
      const x = getX(index);
      const yCpu = getY(log.hardware.cpuUsage);
      const yTemp = getY(log.hardware.temperature);

      if (index === 0) {
        cpuPoints += `M ${x} ${yCpu}`;
        tempPoints += `M ${x} ${yTemp}`;
      } else {
        cpuPoints += ` L ${x} ${yCpu}`;
        tempPoints += ` L ${x} ${yTemp}`;
      }
    });

    const startX = getX(0);
    const endX = getX(data.length - 1);
    const bottomY = padding.top + chartH;

    const cpuArea = `${cpuPoints} L ${endX} ${bottomY} L ${startX} ${bottomY} Z`;
    const tempArea = `${tempPoints} L ${endX} ${bottomY} L ${startX} ${bottomY} Z`;

    // Horizontal grid lines
    const gridLines = [];
    for (let i = 0; i <= 4; i++) {
      const val = yMin + (i * (yMax - yMin)) / 4;
      const y = getY(val);
      gridLines.push({ y, val });
    }

    return { cpuPath: cpuPoints, cpuArea, tempPath: tempPoints, tempArea, gridLines };
  }, [chronologicalLogs]);

  // Renders dynamic bar charts representing request methods distribution
  const trafficDistribution = useMemo(() => {
    const stats: Record<string, { count: number; totalLat: number }> = {
      GET: { count: 0, totalLat: 0 },
      POST: { count: 0, totalLat: 0 },
      PUT: { count: 0, totalLat: 0 },
      DELETE: { count: 0, totalLat: 0 },
    };

    logsHistory.forEach((l) => {
      const m = l.traffic.method;
      if (stats[m]) {
        stats[m].count++;
        stats[m].totalLat += l.traffic.latency;
      }
    });

    return Object.entries(stats).map(([method, data]) => ({
      method,
      count: data.count,
      avgLatency: data.count > 0 ? Math.round(data.totalLat / data.count) : 0,
    }));
  }, [logsHistory]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="historical-charts-section">
      {/* 1. Hardware Metrics Area (Line chart built from scratch using high-performance SVG path matrices) */}
      <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-teal-400" />
            <h3 className="text-sm font-semibold text-slate-200">Hardware Telemetry Matrix</h3>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span className="flex items-center gap-1.5 text-teal-400">
              <span className="w-2 h-2 rounded-full bg-teal-400" /> CPU Usage
            </span>
            <span className="flex items-center gap-1.5 text-amber-500">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Core Temp
            </span>
          </div>
        </div>

        {/* Real SVG viewport */}
        <div className="relative w-full overflow-hidden select-none">
          {chronologicalLogs.length < 2 ? (
            <div className="h-[180px] flex items-center justify-center text-slate-500 text-xs font-mono">
              Synchronizing real-time telemetry pipelines...
            </div>
          ) : (
            <svg viewBox="0 0 800 180" className="w-full h-[180px] overflow-visible">
              <defs>
                <linearGradient id="cpuGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="tempGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {hardwareChartPaths.gridLines.map((line, idx) => (
                <g key={idx}>
                  <line
                    x1="40"
                    y1={line.y}
                    x2="785"
                    y2={line.y}
                    stroke="#1e293b"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <text
                    x="30"
                    y={line.y + 3}
                    fill="#64748b"
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="end"
                  >
                    {line.val}
                  </text>
                </g>
              ))}

              {/* CPU Filled Area & Stroke line */}
              <path d={hardwareChartPaths.cpuArea} fill="url(#cpuGlow)" />
              <path
                d={hardwareChartPaths.cpuPath}
                fill="none"
                stroke="#2dd4bf"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Core Temp Filled Area & Stroke line */}
              <path d={hardwareChartPaths.tempArea} fill="url(#tempGlow)" />
              <path
                d={hardwareChartPaths.tempPath}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        <div className="mt-2 text-[10px] text-slate-500 font-mono text-center flex justify-between px-10">
          <span>{chronologicalLogs.length > 0 ? new Date(chronologicalLogs[0].timestamp).toLocaleTimeString() : "-"}</span>
          <span>Rolling timeline (recent 50 packet intervals)</span>
          <span>{chronologicalLogs.length > 0 ? new Date(chronologicalLogs[chronologicalLogs.length - 1].timestamp).toLocaleTimeString() : "-"}</span>
        </div>
      </div>

      {/* 2. Micro Market prices & sparklines */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-slate-200">Global Asset Market Feed</h3>
        </div>

        <div className="space-y-3.5 flex-1 flex flex-col justify-center">
          {Object.entries(marketMetrics).map(([symbol, data]) => {
            const isUp = data.change >= 0;
            return (
              <div key={symbol} className="flex items-center justify-between bg-slate-950/50 hover:bg-slate-950 px-3 py-2 rounded-lg border border-slate-800/40 transition-colors">
                <div className="flex flex-col">
                  <span className="text-xs font-mono font-bold text-slate-300">{symbol}</span>
                  <span className="text-[10px] text-slate-500 font-mono">Edge Oracle</span>
                </div>

                {/* Price */}
                <div className="flex flex-col items-end">
                  <span className="text-xs font-mono font-bold text-slate-100">
                    ${data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className={`text-[10px] font-mono font-semibold flex items-center gap-0.5 ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                    {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {isUp ? "+" : ""}{data.change}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-600" /> Real-time edge latency sync</span>
          <span className="text-slate-400">1.0s avg</span>
        </div>
      </div>

      {/* 3. HTTP Methods & Latency Distribution */}
      <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-200">Traffic Distribution by HTTP Method</h3>
          </div>
          <span className="text-[10px] font-mono text-slate-500">Sample size: {logsHistory.length} requests</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {trafficDistribution.map((t) => {
            // Colors for methods
            const colorClass =
              t.method === "GET" ? "bg-teal-500" :
              t.method === "POST" ? "bg-blue-500" :
              t.method === "DELETE" ? "bg-red-500" : "bg-yellow-500";
            
            const textColor =
              t.method === "GET" ? "text-teal-400" :
              t.method === "POST" ? "text-blue-400" :
              t.method === "DELETE" ? "text-red-400" : "text-yellow-400";

            const countMax = Math.max(...trafficDistribution.map((td) => td.count), 1);
            const heightPercent = Math.min(100, Math.round((t.count / countMax) * 100));

            return (
              <div key={t.method} className="bg-slate-950 p-4 rounded-xl border border-slate-800/60 flex flex-col items-center justify-between h-[150px]">
                {/* Visual Bar representation */}
                <div className="w-full flex-1 flex items-end justify-center mb-3">
                  <div className="w-8 bg-slate-900 rounded-t-lg h-full relative overflow-hidden flex items-end">
                    <div
                      className={`w-full rounded-t-lg ${colorClass} transition-all duration-500`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-col items-center gap-1 text-center w-full">
                  <span className={`text-xs font-mono font-extrabold ${textColor}`}>{t.method}</span>
                  <div className="flex justify-between w-full px-2 text-[10px] font-mono text-slate-400">
                    <span>Qty: {t.count}</span>
                    <span>Lat: {t.avgLatency}ms</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
