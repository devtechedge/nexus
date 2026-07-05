"use client";

import React, { useState } from "react";
import { useTelemetryStore, UserSession } from "@/store/telemetryStore";
import { ShieldAlert, Terminal, KeyRound, ArrowRight, UserCheck } from "lucide-react";

export const LoginForm: React.FC = () => {
  const { setUser } = useTelemetryStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    setTimeout(() => {
      // Direct hardcoded recruiter check (Chief-level stateless authentication bypass)
      if (
        (username.trim().toLowerCase() === "recruiter" && password === "nexus-edge-2026") ||
        (username.trim().toLowerCase() === "admin" && password === "admin-pass")
      ) {
        const mockUser: UserSession = {
          username: username.toLowerCase(),
          role: username.toLowerCase() === "recruiter" ? "recruiter" : "admin",
          token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.nexus_telemetry_jwt_session_2026",
          authenticated: true,
        };
        setUser(mockUser);
      } else {
        setError("Cryptographic verification failed. Check credentials below.");
      }
      setIsLoading(false);
    }, 800); // realistic network delay simulation
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden" id="login-container">
      {/* Absolute Matrix Glow particle grids */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(13,148,136,0.15),rgba(0,0,0,0))]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-teal-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Cyberpunk terminal login card */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative z-10 select-none">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="p-3 bg-teal-950/60 text-teal-400 rounded-xl border border-teal-500/20 mb-3.5 shadow-lg shadow-teal-500/5 animate-pulse">
            <Terminal className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-mono font-bold tracking-tight text-white uppercase flex items-center gap-2">
            Nexus Gateway Auth
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Sign in to access Edge-Computed Data Telemetry & 3D WebGL PWA
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-lg text-red-400 text-xs font-mono flex items-center gap-2 mb-4 animate-shake">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div className="space-y-1.5">
            <label htmlFor="username" className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold pl-1">
              Gateway Operator ID
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">
                <UserCheck className="w-4 h-4" />
              </span>
              <input
                id="username"
                type="text"
                required
                placeholder="Operator username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-teal-500/80 rounded-xl text-xs text-slate-200 font-mono placeholder-slate-600 outline-none transition-all duration-200"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold pl-1">
              Cryptographic Passphrase
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">
                <KeyRound className="w-4 h-4" />
              </span>
              <input
                id="password"
                type="password"
                required
                placeholder="••••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-teal-500/80 rounded-xl text-xs text-slate-200 font-mono placeholder-slate-600 outline-none transition-all duration-200"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-mono font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed mt-6"
          >
            {isLoading ? "Validating cryptos..." : "Initiate Connection"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Hardcoded credential guidelines for recruiter review convenience */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/40 select-text">
          <span className="text-[9px] font-mono uppercase tracking-widest text-teal-400 font-bold block mb-2">
            Demo Recruiter Access
          </span>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="flex flex-col">
              <span className="text-slate-500 text-[10px]">OPERATOR ID</span>
              <span className="text-slate-300 select-all font-semibold">recruiter</span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-500 text-[10px]">PASSPHRASE</span>
              <span className="text-slate-300 select-all font-semibold">nexus-edge-2026</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
