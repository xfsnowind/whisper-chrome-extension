/**
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export {};

declare global {
  // Shared self.ai APIs
  interface WindowOrWorkerGlobalScope {
    readonly ai: AI;
  }

  interface AI {
    readonly languageModel: AILanguageModelFactory;
  }

  interface AICreateMonitor extends EventTarget {
    ondownloadprogress: ((this: AICreateMonitor, ev: Event) => any) | null;
  }

  type AICreateMonitorCallback = (monitor: AICreateMonitor) => void;

  type AICapabilityAvailability = "readily" | "after-download" | "no";

  // LanguageModel
  interface AILanguageModelFactory {
    create(options?: AILanguageModelCreateOptions): Promise<AILanguageModel>;
    capabilities(): Promise<AILanguageModelCapabilities>;
  }

  interface AILanguageModel extends EventTarget {
    prompt(input: string, options?: AILanguageModelPromptOptions): Promise<string>;
    promptStreaming(input: string, options?: AILanguageModelPromptOptions): ReadableStream;
    countPromptTokens(input: string, options?: AILanguageModelPromptOptions): Promise<number>;
    readonly maxTokens: number;
    readonly tokensSoFar: number;
    readonly tokensLeft: number;
    readonly topK: number;
    readonly temperature: number;
    clone(): Promise<AILanguageModel>;
    destroy(): void;
  }

  interface AILanguageModelCapabilities {
    readonly available: AICapabilityAvailability;
    readonly defaultTopK: number | null;
    readonly maxTopK: number | null;
    readonly defaultTemperature: number | null;
  }

  interface AILanguageModelCreateOptions {
    signal?: AbortSignal;
    monitor?: AICreateMonitorCallback;
    systemPrompt?: string;
    initialPrompts?: AILanguageModelPrompt[];
    topK?: number;
    temperature?: number;
  }

  interface AILanguageModelPrompt {
    role: AILanguageModelPromptRole;
    content: string;
  }

  interface AILanguageModelPromptOptions {
    signal?: AbortSignal;
  }

  type AILanguageModelPromptRole = "system" | "user" | "assistant";

  // Existing types
  type AISummarizerType = "tl;dr" | "key-points" | "teaser" | "headline";
  type AISummarizerFormat = "plain-text" | "markdown";
  type AISummarizerLength = "short" | "medium" | "long";

  type AISummarizerCreateOptions = {
    type?: AISummarizerType;
    length?: AISummarizerLength;
    format?: AISummarizerFormat;
  };

  type AISummarizer = {
    capabilities: () => Promise<AISummarizerCapabilities>;
    create: (options?: AISummarizerCreateOptions) => Promise<AISummarizerSession>;
  };

  type AISummarizerCapabilities = {
    available: AICapabilityAvailability;
  };

  type AIModelDownloadProgressEvent = {
    loaded: number;
    total: number;
  };

  type AIModelDownloadCallback = (file: string, event: AIModelDownloadProgressEvent) => void;

  type AISummarizerSession = {
    destroy: () => void;
    ready: Promise<void>;
    summarize: (text: string) => Promise<string>;
    addEventListener: (type: string, callback: AIModelDownloadCallback) => void;
  };

  interface Window {
    ai: AI & {
      summarizer?: AISummarizer;
    };
  }
}
