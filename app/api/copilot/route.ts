import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

export async function POST(req: NextRequest) {
  try {
    const { message, metricsHistory } = await req.json();

    const systemInstruction = `You are an elite Operations and Telemetry Copilot named Nexus-AI.
Your role is to analyze high-frequency server and system metrics, detect operational trends, and answer user queries with absolute technical precision.
Speak like an experienced Principal Site Reliability Engineer (SRE). Keep your answers highly structural, accurate, bulleted where appropriate, and actionable.

Here is the current state of our live telemetry stream:
- Average CPU load: ${metricsHistory?.avgCpu || "32.4"}%
- Core temperature: ${metricsHistory?.avgTemp || "42.8"}°C
- Core network throughput: Inbound ${metricsHistory?.avgNetIn || "182"} KB/s, Outbound ${metricsHistory?.avgNetOut || "245"} KB/s
- System anomalies recorded: ${metricsHistory?.anomalyCount || "0"} in last window
- API Average Latency: ${metricsHistory?.avgLatency || "84"}ms
- Global region traffic load: ${metricsHistory?.topRegion || "us-east (primary)"}

Answer the user's question with direct reference to these metrics. Suggest micro-architectural optimizations or troubleshooting strategies if they ask about load, spikes, or system failures.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: message,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const answer = response.text || "Unable to formulate analysis from the telemetry data stream.";

    return NextResponse.json({ text: answer });
  } catch (err: any) {
    console.error("Gemini copilot api error:", err);
    return NextResponse.json(
      { error: "Operational Copilot failed to analyze: " + err.message },
      { status: 500 }
    );
  }
}
