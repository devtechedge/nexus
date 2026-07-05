"use client";

import React, { useState, useMemo } from "react";
import { useTelemetryStore } from "@/store/telemetryStore";
import { Leaf, DollarSign, BatteryCharging, Zap, HelpCircle, AlertCircle, RefreshCw } from "lucide-react";

export const GreenOpsTab: React.FC = () => {
  const { logsHistory, latestLog } = useTelemetryStore();
  const [nodeCount, setNodeCount] = useState(12);
  const [costPerKwh, setCostPerKwh] = useState(0.12); // in USD

  // Compute stats
  const stats = useMemo(() => {
    // Current CPU average
    const cpuVal = latestLog ? latestLog.hardware.cpuUsage : 30;
    
    // Thermal efficiency
    const tempVal = latestLog ? latestLog.hardware.temperature : 42;

    // Estimate Power Draw in Watts
    // Base load: 85 Watts per node, max load: 240 Watts per node
    const powerDrawPerNode = 85 + (cpuVal / 100) * 155;
    const totalPowerDraw = Math.round(powerDrawPerNode * nodeCount); // in Watts
    const totalPowerDrawKw = totalPowerDraw / 1000;

    // Estimate Carbon Intensity (e.g., global average 380 grams of CO2 per kWh)
    const carbonFactor = 380; 
    const carbonDrawHr = Math.round(totalPowerDrawKw * carbonFactor); // grams of CO2/hr

    // Monthly financial projections
    const monthlyKwh = totalPowerDrawKw * 24 * 30.5;
    const monthlyCost = Math.round(monthlyKwh * costPerKwh);

    return {
      powerDrawPerNode: Math.round(powerDrawPerNode),
      totalPowerDraw,
      carbonDrawHr,
      monthlyCost,
      monthlyKwh: Math.round(monthlyKwh),
      thermalEfficiency: Math.round(100 - (tempVal - 30) * 1.5),
    };
  }, [latestLog, nodeCount, costPerKwh]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top green metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Power Efficiency */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between shadow">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              Compute Energy Load
            </h3>
            <BatteryCharging className="w-5 h-5 text-emerald-400 animate-pulse" />
          </div>
          <div className="my-4">
            <div className="text-2xl font-mono font-extrabold text-white">
              {stats.totalPowerDraw.toLocaleString()} W
            </div>
            <p className="text-[11px] text-slate-500 font-mono mt-1">
              Estimated active micro-architectural draw ({stats.powerDrawPerNode}W per node across {nodeCount} nodes)
            </p>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-400">
            <Leaf className="w-3.5 h-3.5" /> Carbon footprint: {stats.carbonDrawHr} gCO2 / hr
          </div>
        </div>

        {/* Financial run rates */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between shadow">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              Virtual Run Rate Projection
            </h3>
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="my-4">
            <div className="text-2xl font-mono font-extrabold text-white">
              ${stats.monthlyCost.toLocaleString()} / mo
            </div>
            <p className="text-[11px] text-slate-500 font-mono mt-1">
              Est. energy metrics assuming {stats.monthlyKwh.toLocaleString()} kWh consumption monthly
            </p>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            Utility Price Index: ${costPerKwh.toFixed(2)} / kWh
          </div>
        </div>

        {/* Thermal cooling efficiency */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between shadow">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              Cooling Coefficient (COP)
            </h3>
            <Zap className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="my-4">
            <div className="text-2xl font-mono font-extrabold text-white">
              {stats.thermalEfficiency}% Efficiency
            </div>
            <p className="text-[11px] text-slate-500 font-mono mt-1">
              Derived thermal margin above silicon core junction threshold limit
            </p>
          </div>
          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-slate-600" /> PUE baseline: 1.15 (Optimal)
          </div>
        </div>

      </div>

      {/* Calculator config & suggestions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Cost projections parameters */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 shadow">
          <h3 className="text-xs font-mono font-bold uppercase text-white tracking-wider pb-2 border-b border-slate-800">
            Interactive GreenOps Hyper-Calculator
          </h3>

          <div className="space-y-4 font-mono">
            {/* Cluster node sizing */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Active Core Cluster Sizing:</span>
                <span className="text-emerald-400 font-bold">{nodeCount} Virtual Nodes</span>
              </div>
              <input
                type="range"
                min="2"
                max="64"
                value={nodeCount}
                onChange={(e) => setNodeCount(parseInt(e.target.value))}
                className="w-full accent-emerald-400 cursor-pointer"
              />
              <span className="text-[9px] text-slate-500 block">
                Adjust virtual nodes counting to approximate larger datacenters.
              </span>
            </div>

            {/* Utility Grid Price */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Utility Grid Pricing Index:</span>
                <span className="text-emerald-400 font-bold">${costPerKwh.toFixed(2)} / kWh</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.45"
                step="0.01"
                value={costPerKwh}
                onChange={(e) => setCostPerKwh(parseFloat(e.target.value))}
                className="w-full accent-emerald-400 cursor-pointer"
              />
              <span className="text-[9px] text-slate-500 block">
                Varies based on region and time-of-use renewable tariffs.
              </span>
            </div>
          </div>
        </div>

        {/* AI Recommendations */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow">
          <h3 className="text-xs font-mono font-bold uppercase text-white tracking-wider pb-2 border-b border-slate-800">
            Carbon Reduction & Resource Tuning Advice
          </h3>

          <div className="space-y-3 font-mono text-[11px] text-slate-300">
            <div className="p-2.5 border border-emerald-950 bg-emerald-950/10 rounded flex gap-3">
              <Leaf className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div>
                <strong className="text-emerald-400 block font-bold mb-0.5">Activate Downscaling Schedules</strong>
                Analyze night-time latency metrics to scale EU-West and AP-Northeast nodes during non-peak operational windows, reducing monthly draw by up to 25%.
              </div>
            </div>

            <div className="p-2.5 border border-emerald-950 bg-emerald-950/10 rounded flex gap-3">
              <Zap className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div>
                <strong className="text-emerald-400 block font-bold mb-0.5">Frequency-Scaling Adjustment</strong>
                Core micro-processors should utilize dynamic frequency scaling. Keep active silicon junctions below 50°C to secure thermal resistance power drops.
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
