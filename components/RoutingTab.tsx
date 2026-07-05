"use client";

import React, { useState, useMemo } from "react";
import { useTelemetryStore } from "@/store/telemetryStore";
import { Globe, RefreshCw, BarChart2, Radio, Server, Compass, Percent, TrendingUp } from "lucide-react";

export const RoutingTab: React.FC = () => {
  const { logsHistory, routingWeights, setRoutingWeights } = useTelemetryStore();

  // Dynamic regional stats derived from streaming metrics
  const regionalMetrics = useMemo(() => {
    const nodes = [
      { id: "us-east", name: "US-East (Virginia)", latBase: 45, loadBase: 25 },
      { id: "us-west", name: "US-West (Oregon)", latBase: 65, loadBase: 20 },
      { id: "eu-west", name: "EU-West (Frankfurt)", latBase: 120, loadBase: 30 },
      { id: "ap-northeast", name: "AP-Northeast (Tokyo)", latBase: 210, loadBase: 15 },
      { id: "sa-east", name: "SA-East (São Paulo)", latBase: 180, loadBase: 10 },
    ];

    // Compute live average latency per region from history
    return nodes.map((node) => {
      const regionLogs = logsHistory.filter((l) => l.traffic.region === node.id);
      let avgLat = node.latBase;
      let activeRequestCount = regionLogs.length;

      if (regionLogs.length > 0) {
        const sum = regionLogs.reduce((acc, l) => acc + l.traffic.latency, 0);
        avgLat = Math.round(sum / regionLogs.length);
      }

      return {
        ...node,
        liveLatency: avgLat,
        requestCount: activeRequestCount,
        weight: routingWeights[node.id] || 20,
      };
    });
  }, [logsHistory, routingWeights]);

  const handleWeightChange = (nodeId: string, val: number) => {
    const nextWeights = { ...routingWeights, [nodeId]: val };
    setRoutingWeights(nextWeights);
  };

  const totalWeightsSum = Object.values(routingWeights).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-teal-950 text-teal-400 rounded-lg border border-teal-500/20">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase block font-mono">Edge POPs Active</span>
            <span className="text-lg font-mono font-bold text-white">5 Global PoPs</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-indigo-950 text-indigo-400 rounded-lg border border-indigo-500/20">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase block font-mono">Global Avg Latency</span>
            <span className="text-lg font-mono font-bold text-teal-400">
              {regionalMetrics.length > 0
                ? Math.round(regionalMetrics.reduce((acc, n) => acc + n.liveLatency, 0) / regionalMetrics.length)
                : 120} ms
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-amber-950 text-amber-500 rounded-lg border border-amber-500/20">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase block font-mono">Total Allocation Weight</span>
            <span className={`text-lg font-mono font-bold ${totalWeightsSum === 100 ? "text-emerald-400" : "text-yellow-500"}`}>
              {totalWeightsSum}%
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-emerald-950 text-emerald-400 rounded-lg border border-emerald-500/20">
            <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase block font-mono">Load Distribution</span>
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase">
              {totalWeightsSum === 100 ? "Balanced" : "Drifting Calibration"}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Topology Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Topology Node Map */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
            <Compass className="w-4 h-4 text-teal-400" />
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
              Edge Traffic Balancer Topology
            </h2>
          </div>

          {/* Graphical Topology Map Grid */}
          <div className="relative h-[250px] bg-slate-950 rounded-xl border border-slate-850 flex items-center justify-center overflow-hidden">
            {/* Visual connector lines */}
            <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-30" />
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
              <line x1="50%" y1="50%" x2="20%" y2="25%" stroke="#14b8a6" strokeWidth="1.5" strokeDasharray="4" />
              <line x1="50%" y1="50%" x2="80%" y2="25%" stroke="#14b8a6" strokeWidth="1.5" strokeDasharray="4" />
              <line x1="50%" y1="50%" x2="15%" y2="75%" stroke="#14b8a6" strokeWidth="1.5" strokeDasharray="4" />
              <line x1="50%" y1="50%" x2="85%" y2="75%" stroke="#14b8a6" strokeWidth="1.5" strokeDasharray="4" />
              <line x1="50%" y1="50%" x2="50%" y2="85%" stroke="#14b8a6" strokeWidth="1.5" strokeDasharray="4" />
            </svg>

            {/* Central SRE Balancer Node */}
            <div className="absolute flex flex-col items-center bg-teal-950/60 border border-teal-500/40 p-2.5 rounded-xl z-10 shadow-lg text-center backdrop-blur-sm max-w-[120px]">
              <Server className="w-4 h-4 text-teal-400 animate-bounce mb-1" />
              <span className="text-[10px] font-mono text-white font-bold tracking-wider">LB CORE</span>
              <span className="text-[8px] font-mono text-slate-400">DNS Round-Robin</span>
            </div>

            {/* Edge PoPs */}
            <div className="absolute top-1/4 left-[8%] flex flex-col items-center bg-slate-900/90 border border-slate-800 p-2 rounded shadow text-center text-[10px] font-mono">
              <span className="font-bold text-white">US-East</span>
              <span className="text-teal-400 font-bold">{routingWeights["us-east"]}%</span>
            </div>

            <div className="absolute top-1/4 right-[8%] flex flex-col items-center bg-slate-900/90 border border-slate-800 p-2 rounded shadow text-center text-[10px] font-mono">
              <span className="font-bold text-white">US-West</span>
              <span className="text-teal-400 font-bold">{routingWeights["us-west"]}%</span>
            </div>

            <div className="absolute bottom-[20%] left-[5%] flex flex-col items-center bg-slate-900/90 border border-slate-800 p-2 rounded shadow text-center text-[10px] font-mono">
              <span className="font-bold text-white">EU-West</span>
              <span className="text-teal-400 font-bold">{routingWeights["eu-west"]}%</span>
            </div>

            <div className="absolute bottom-[20%] right-[5%] flex flex-col items-center bg-slate-900/90 border border-slate-800 p-2 rounded shadow text-center text-[10px] font-mono">
              <span className="font-bold text-white">AP-North</span>
              <span className="text-teal-400 font-bold">{routingWeights["ap-northeast"]}%</span>
            </div>

            <div className="absolute bottom-[8%] left-[43%] flex flex-col items-center bg-slate-900/90 border border-slate-800 p-2 rounded shadow text-center text-[10px] font-mono">
              <span className="font-bold text-white">SA-East</span>
              <span className="text-teal-400 font-bold">{routingWeights["sa-east"]}%</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 font-mono text-center">
            * Visualizing relative routing weights dynamically assigned via local state variables.
          </p>
        </div>

        {/* Right Column: Weight Sliders & Calibration */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-teal-400" />
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                CDN Routing Sliders
              </h2>
            </div>
            {totalWeightsSum !== 100 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 font-mono font-bold animate-pulse">
                Unbalanced ({totalWeightsSum}%)
              </span>
            )}
          </div>

          <div className="space-y-4">
            {regionalMetrics.map((node) => (
              <div key={node.id} className="space-y-1.5 font-mono">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">{node.name}</span>
                  <div className="space-x-2 text-[10px]">
                    <span className="text-slate-500">RTT: <strong className="text-slate-300">{node.liveLatency}ms</strong></span>
                    <span className="text-teal-400 font-bold">{node.weight}%</span>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={node.weight}
                    onChange={(e) => handleWeightChange(node.id, parseInt(e.target.value))}
                    className="flex-1 accent-teal-400 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Auto calibrate trigger */}
          <button
            onClick={() => {
              setRoutingWeights({
                "us-east": 20,
                "us-west": 20,
                "eu-west": 20,
                "ap-northeast": 20,
                "sa-east": 20,
              });
            }}
            className="w-full py-2 bg-slate-950 border border-slate-800 text-xs text-slate-400 hover:text-white hover:bg-slate-800 font-mono rounded cursor-pointer transition flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Re-Calibrate (20% Equal Split)
          </button>
        </div>

      </div>
    </div>
  );
};
