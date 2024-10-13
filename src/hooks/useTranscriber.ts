import {
  AllTasks,
  AutomaticSpeechRecognitionPipeline,
  pipeline,
  PipelineType,
  PreTrainedTokenizer,
  WhisperTextStreamer
} from "@huggingface/transformers";
import { useCallback, useState } from "react";

export interface TranscriberData {
  isBusy: boolean;
  tps?: number;
  text: string;
  chunks: { text: string; timestamp: [number, number | null] }[];
}

interface ProgressItem {
  file: string;
  loaded: number;
  progress: number;
  total: number;
  name: string;
  status: string;
}

interface TranscriberUpdateData {
  data: {
    text: string;
    chunks: { text: string; timestamp: [number, number | null] }[];
    tps: number;
  };
}

type StreamCallbackMessage =
  | { status: "progress"; progress: number; file: string }
  | {
      status: "initiate";
      file: string;
      loaded: number;
      progress: number;
      total: number;
      name: string;
    }
  | { status: "error"; data: Error }
  | { status: "done"; file: string }
  | (TranscriberUpdateData & { status: "update" });

// Define model factories
// Ensures only one model is created of each type
class PipelineFactory {
  static task: PipelineType | null = null;
  static model: string | undefined = undefined;
  static instance: Promise<AllTasks[keyof AllTasks]> | null;
  static tokenizer: PreTrainedTokenizer | null = null;

  constructor(tokenizer: PreTrainedTokenizer, model: string) {
    this.tokenizer = tokenizer;
    this.model = model;
  }

  static async getInstance(progress_callback?: (data: any) => void) {
    if (this.task === null) {
      throw new Error("The task has not been set");
    }
    if (this.instance === null) {
      this.instance = pipeline(this.task, this.model, {
        dtype: {
          encoder_model:
            this.model === "onnx-community/whisper-large-v3-turbo"
              ? "fp16"
              : "fp32",
          decoder_model_merged: "q4" // or 'fp32' ('fp16' is broken)
        },
        device: "webgpu",
        progress_callback
      });
    }

    return this.instance;
  }
}

class AutomaticSpeechRecognitionPipelineFactory extends PipelineFactory {
  static task = "automatic-speech-recognition" as PipelineType;
}

const transcribe = async ({
  audio,
  model,
  subtask,
  language,
  handleMessage
}: {
  audio: AudioBuffer;
  language: string;
  subtask: string;
  model: string;
  handleMessage: (message: StreamCallbackMessage) => void;
}) => {
  const isDistilWhisper = model.startsWith("distil-whisper/");

  const p = AutomaticSpeechRecognitionPipelineFactory;
  if (p.model !== model) {
    // Invalidate model if different
    p.model = model;

    if (p.instance !== null) {
      const instance =
        (await p.getInstance()) as AutomaticSpeechRecognitionPipeline;
      if (instance) {
        instance.dispose();
      }
      p.instance = null;
    }
  }

  // Load transcriber model
  console.log("Load transcriber model");
  const transcriber = await p.getInstance((data) => {
    handleMessage(data);
  });

  const time_precision =
    transcriber.processor.feature_extractor.config.chunk_length /
    transcriber.model.config.max_source_positions;

  // Storage for chunks to be processed. Initialise with an empty chunk.
  /** @type {{ text: string; offset: number, timestamp: [number, number | null] }[]} */
  const chunks: Array<{
    text: string;
    offset: number;
    timestamp: [number, number | null];
  }> = [];

  // TODO: Storage for fully-processed and merged chunks
  // let decoded_chunks = [];

  const chunk_length_s = isDistilWhisper ? 20 : 30;
  const stride_length_s = isDistilWhisper ? 3 : 5;

  let chunk_count = 0;
  let start_time;
  let num_tokens: number = 0;
  let tps: number;

  console.log("before stream: time_precision", time_precision);
  const streamer = new WhisperTextStreamer(transcriber.tokenizer, {
    time_precision,
    on_chunk_start: (x) => {
      const offset = (chunk_length_s - stride_length_s) * chunk_count;
      chunks.push({
        text: "",
        timestamp: [offset + x, null],
        finalised: false,
        offset
      });
    },
    token_callback_function: (x) => {
      start_time ??= performance.now();
      if (num_tokens++ > 0) {
        tps = (num_tokens / (performance.now() - start_time)) * 1000;
      }
    },
    callback_function: (x) => {
      if (chunks.length === 0) return;
      // Append text to the last chunk
      chunks[chunks.length - 1].text += x;
      // handleMessage({
      //   status: "update",
      //   data: {
      //     text: "", // No need to send full text yet
      //     chunks,
      //     tps
      //   }
      // });
    },
    on_chunk_end: (x) => {
      const current = chunks[chunks.length - 1];
      current.timestamp[1] = x + current.offset;
      current.finalised = true;
    },
    on_finalize: () => {
      start_time = null;
      num_tokens = 0;
      ++chunk_count;
    }
  });

  // Actually run transcription
  const output = await transcriber(audio, {
    // Greedy
    top_k: 0,
    do_sample: false,

    // Sliding window
    chunk_length_s,
    stride_length_s,

    // Language and task
    language,
    task: subtask,

    // Return timestamps
    return_timestamps: true,
    force_full_sequences: false,

    // Callback functions
    streamer // after each generation step
  }).catch((error: Error) => {
    console.error(error);
    handleMessage({ status: "error", data: error });
    return null;
  });

  return {
    tps,
    ...output
  };
};

export function useTranscriber() {
  const [transcript, setTranscript] = useState<TranscriberData | undefined>(
    undefined
  );
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);
  const [isBusy, setIsBusy] = useState(false);

  const handleMessage = useCallback((message: StreamCallbackMessage) => {
    switch (message.status) {
      case "progress":
        // Model file progress: update one of the progress items.
        setProgressItems((prev) =>
          prev.map((item) => {
            if (item.file === message.file) {
              return { ...item, progress: message.progress };
            }
            return item;
          })
        );
        break;
      case "update":
        // Progress
        //   setTranscript({
        //     isBusy: true,
        //     text: message.data.text,
        //     tps: message.data.tps,
        //     chunks: message.data.chunks
        //   });
        setIsBusy(true);
        break;

      case "initiate":
        // Model file start load: add a new progress item to the list.
        // setIsModelLoading(true);
        setProgressItems((prev) => [...prev, message]);
        break;
      // case "ready":
      //   setIsModelLoading(false);
      // break;
      case "error":
        setIsBusy(false);
        alert(
          `An error occurred: "${message.data.message}". Please file a bug report.`
        );
        break;
      case "done":
        // Model file loaded: remove the progress item from the list.
        setProgressItems((prev) =>
          prev.filter((item) => item.file !== message.file)
        );
        break;

      default:
        // initiate/download/done
        break;
    }
  }, []);

  const postRequest = useCallback(
    async (audioData: AudioBuffer | undefined) => {
      if (audioData) {
        setIsBusy(true);
        let audio;
        if (audioData.numberOfChannels === 2) {
          const SCALING_FACTOR = Math.sqrt(2);

          const left = audioData.getChannelData(0);
          const right = audioData.getChannelData(1);

          audio = new Float32Array(left.length);
          for (let i = 0; i < audioData.length; ++i) {
            audio[i] = (SCALING_FACTOR * (left[i] + right[i])) / 2;
          }
        } else {
          // If the audio is not stereo, we can just use the first channel:
          audio = audioData.getChannelData(0);
        }

        const result = await transcribe({
          audio,
          model: "onnx-community/whisper-tiny",
          language: "english",
          subtask: "transcribe",
          handleMessage
        });
        if (result === null) return;

        setIsBusy(false);
        setTranscript(result);
      }
    },
    [handleMessage]
  );

  return { start: postRequest, transcript, progressItems, isBusy };
}
