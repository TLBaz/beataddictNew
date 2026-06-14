import { AIWorkflow } from "../ai/AIWorkflow";
import { PluginManager } from "../plugins/pluginManager";

export type HealthCheckStatus = "ok" | "warn" | "fail";

export interface HealthCheckResult {
  name: string;
  status: HealthCheckStatus;
  details: string;
}

export const runSystemHealthCheck = async (
  audioCtx: AudioContext | null = null,
): Promise<HealthCheckResult[]> => {
  const results: HealthCheckResult[] = [];

  if (typeof window === "undefined") {
    results.push({
      name: "Browser environment",
      status: "fail",
      details: "Health checks require a browser runtime.",
    });
    return results;
  }

  const AudioCtx =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) {
    results.push({
      name: "Web Audio API",
      status: "fail",
      details: "AudioContext is not available in this browser.",
    });
    return results;
  }

  let ctx = audioCtx;
  let createdContext = false;
  try {
    if (!ctx) {
      ctx = new AudioCtx();
      createdContext = true;
    }
    results.push({
      name: "AudioContext",
      status: "ok",
      details: "Web Audio API is available and initialized.",
    });
  } catch (error: any) {
    results.push({
      name: "AudioContext",
      status: "fail",
      details: `Failed to initialize audio context: ${error?.message || error}`,
    });
  }

  try {
    const chain = PluginManager.buildPluginChain(
      "Beat Pattern",
      {
        genre: "House",
        mood: "Energetic",
      },
      "LocalHost",
    );
    results.push({
      name: "Plugin chain",
      status: chain.length > 0 ? "ok" : "warn",
      details:
        chain.length > 0
          ? "Plugin chain successfully constructed."
          : "Plugin manager returned an empty chain for the default stage.",
    });
  } catch (error: any) {
    results.push({
      name: "Plugin chain",
      status: "fail",
      details: `Plugin chain validation failed: ${error?.message || error}`,
    });
  }

  try {
    const localDrums = await (AIWorkflow.generateLocalDrums?.({
      genre: "House",
      mood: "Energetic",
      complexity: 65,
      density: 65,
    }) as Promise<any>);
    const valid =
      localDrums?.pattern && Object.keys(localDrums.pattern).length > 0;
    results.push({
      name: "Local AI fallback",
      status: valid ? "ok" : "warn",
      details: valid
        ? "Local AI fallback is available and returned a valid pattern."
        : "Local AI fallback did not return a valid pattern.",
    });
  } catch (error: any) {
    results.push({
      name: "Local AI fallback",
      status: "fail",
      details: `Local AI fallback failed: ${error?.message || error}`,
    });
  }

  if (createdContext && ctx) {
    try {
      await ctx.close();
    } catch {
      // ignore close errors
    }
  }

  return results;
};
