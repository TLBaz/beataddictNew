export interface Track {
  id: string;
  name: string;
  type: "drums" | "melody" | "bass" | "vocals" | "fx";
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  color: string;
  pattern: boolean[][];
}

export interface Project {
  id: string;
  name: string;
  bpm: number;
  tracks: Track[];
  createdAt: string;
  updatedAt: string;
}

export interface AIGenerationStage {
  id: string;
  name: string;
  description: string;
  icon: string;
  completed: boolean;
}

export interface Sample {
  id: string;
  name: string;
  category: "kick" | "snare" | "hihat" | "clap" | "perc" | "synth" | "bass";
  url: string;
  duration: number;
}

export interface PulseMessage {
  id: string;
  type: "user" | "pulse";
  content: string;
  timestamp: string;
}

export type PluginCategoryId =
  | "synth"
  | "vocal"
  | "sampler"
  | "mixing"
  | "creative"
  | "utility";
export type PluginHostSupport =
  | "Ableton"
  | "FL Studio"
  | "Logic"
  | "Reaper"
  | "LocalHost";

export interface PluginParameter {
  id: string;
  name: string;
  min: number;
  max: number;
  default: number;
  unit: string;
  automationCapable: boolean;
}

export interface PluginPreset {
  id: string;
  name: string;
  description: string;
  parameterValues: Record<string, number | string>;
}

export interface PluginRouting {
  source: string;
  destination: string;
  insertPoint?: string;
  sends?: string[];
  returns?: string[];
}

export interface PluginAutomationBinding {
  id: string;
  name: string;
  parameterId: string;
  controlSource: "LFO" | "Envelope" | "Macro" | "MIDI CC" | "Velocity";
  curve: "linear" | "log" | "sine" | "step";
  range: {
    min: number;
    max: number;
  };
}

export interface PluginMetadata {
  id: string;
  name: string;
  vendor: string;
  category: PluginCategoryId;
  description: string;
  hostSupport: PluginHostSupport[];
  defaultPresetId: string;
  parameters: PluginParameter[];
  presets: PluginPreset[];
  routing: PluginRouting;
  automationBindings?: PluginAutomationBinding[];
  bridgeSupport?: boolean;
}

export interface PluginCategoryConfig {
  id: PluginCategoryId;
  name: string;
  description: string;
  hostSupport: PluginHostSupport[];
}

export interface PluginChainItem {
  pluginId: string;
  pluginName: string;
  hostSupport: PluginHostSupport[];
  preset: PluginPreset;
  route: PluginRouting;
  automationBindings: PluginAutomationBinding[];
  order: number;
}

export interface PluginBridgePayload {
  host: string;
  pluginChain: PluginChainItem[];
  bridgeMode: "Ableton/FL Studio";
  timestamp: string;
}

export interface PluginStageParams {
  genre?: string;
  mood?: string;
  complexity?: number;
  density?: number;
  style?: string;
  host?: PluginHostSupport;
}
