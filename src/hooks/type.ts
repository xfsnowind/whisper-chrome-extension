export type Chunks = { text: string; timestamp: [number, number | null] }[];

export interface TranscriberData {
  // isBusy: boolean;
  tps: number;
  text: string;
  chunks?: Chunks;
}

export interface ModelFileProgressItem {
  file: string;
  loaded: number;
  progress: number;
  total: number;
  name: string;
  status: string;
}

export type ModelFileMessage =
  | (ModelFileProgressItem & { status: "initiate" })
  | { status: "progress"; progress: number; file: string }
  | { status: "ready" }
  | { status: "done"; file: string };

export type TranscrbeMessage =
  | {
      chunks: Chunks;
      tps: number;
      status: "transcribing";
    }
  | { status: "error"; error: Error };
