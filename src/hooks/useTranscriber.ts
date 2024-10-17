import {
  AllTasks,
  AudioPipelineInputs,
  AutomaticSpeechRecognitionPipeline,
  pipeline,
  PipelineType,
  PreTrainedTokenizer,
  WhisperTextStreamer,
  WhisperTokenizer,
} from "@huggingface/transformers";
import { useCallback, useState } from "react";
import { match } from "ts-pattern";

type Chunks = { text: string; timestamp: [number, number | null] }[];

export interface TranscriberData {
  isBusy: boolean;
  tps: number;
  text: string;
  chunks: Chunks;
}

interface ModelFileProgressItem {
  file: string;
  loaded: number;
  progress: number;
  total: number;
  name: string;
  status: string;
}

type ModelFileMessage =
  | (ModelFileProgressItem & { status: "initiate" })
  | { status: "progress"; progress: number; file: string }
  | { status: "ready"; file: string }
  | { status: "done"; file: string };

type TranscrbeMessage =
  | {
      chunks: Chunks;
      tps: number;
      status: "transcribing";
    }
  | { status: "error"; error: Error };

// Define model factories
// Ensures only one model is created of each type
class PipelineFactory {
  static task: PipelineType | null = null;
  static model: string | undefined = undefined;
  static instance: Promise<AllTasks[keyof AllTasks]> | null;
  static tokenizer: PreTrainedTokenizer | null = null;

  static async getInstance(
    handleModelFilesCallback?: (data: ModelFileMessage) => void,
  ) {
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
          decoder_model_merged: "q4", // or 'fp32' ('fp16' is broken)
        },
        device: "webgpu",
        progress_callback: handleModelFilesCallback,
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
  handleModelFilesMessage,
  handleTranscribeMessage,
}: {
  audio: AudioPipelineInputs;
  language: string;
  subtask: string;
  model: string;
  handleModelFilesMessage: (message: ModelFileMessage) => void;
  handleTranscribeMessage: (message: TranscrbeMessage) => void;
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
  const transcriber = (await p.getInstance(
    handleModelFilesMessage,
  )) as AutomaticSpeechRecognitionPipeline;

  const time_precision =
    transcriber.processor.feature_extractor.config.chunk_length /
    transcriber.model.config.max_source_positions;

  // Storage for chunks to be processed. Initialise with an empty chunk.
  const chunks: Array<{
    text: string;
    offset: number;
    timestamp: [number, number | null];
    finalised: boolean;
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
  const streamer = new WhisperTextStreamer(
    transcriber.tokenizer as WhisperTokenizer,
    {
      time_precision,
      on_chunk_start: (x) => {
        const offset = (chunk_length_s - stride_length_s) * chunk_count;
        chunks.push({
          text: "",
          timestamp: [offset + x, null],
          finalised: false,
          offset,
        });
      },
      token_callback_function: () => {
        start_time ??= performance.now();
        if (num_tokens++ > 0) {
          tps = (num_tokens / (performance.now() - start_time)) * 1000;
        }
      },
      // Function to call when a piece of text is ready to display
      callback_function: (x) => {
        if (chunks.length === 0) return;
        // Append text to the last chunk
        chunks[chunks.length - 1].text += x;
        handleTranscribeMessage({
          status: "transcribing",
          chunks,
          tps,
        });
      },
      on_chunk_end: (x) => {
        const current = chunks[chunks.length - 1];
        current.timestamp[1] = x + current.offset;
        current.finalised = true;
      },
      // Function to call when the stream is finalized
      on_finalize: () => {
        start_time = null;
        num_tokens = 0;
        ++chunk_count;
      },
    },
  );

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
    streamer, // after each generation step
  }).catch((error: Error) => {
    console.error(error);
    handleTranscribeMessage({ status: "error", error });
    return null;
  });

  return {
    tps,
    ...output,
  };
};

export function useTranscriber() {
  const [transcript, setTranscript] = useState<TranscriberData | undefined>(
    undefined,
  );
  const [progressItems, setProgressItems] = useState<
    Array<ModelFileProgressItem>
  >([]);
  const [isBusy, setIsBusy] = useState(false);

  const handleModelFilesMessage = useCallback((message: ModelFileMessage) => {
    match(message)
      .with({ status: "initiate" }, (msg) => {
        // Model file start load: add a new progress item to the list.
        // setIsModelLoading(true);
        console.log("init", msg);
        setProgressItems((prev) => [...prev, msg]);
      })
      .with({ status: "progress" }, (msg) => {
        // loading the model file
        // Model file progress: update one of the progress items.
        // console.log("progress:", msg);
        setProgressItems((prev) =>
          prev.map((item) => {
            if (item.file === msg.file) {
              return { ...item, progress: msg.progress };
            }
            return item;
          }),
        );
      })
      .with({ status: "done" }, (msg) => {
        // Model file loaded: remove the progress item from the list.
        console.log("done:", msg);
        setProgressItems((prev) =>
          prev.filter((item) => item.file !== msg.file),
        );
      })
      .with({ status: "ready" }, (msg) => {
        // all the model files are ready
        console.log("all the model files are ready", msg);
        // setIsModelLoading(false);
      })

      .otherwise((data) => {
        console.log("otherwise:", data);
      });
  }, []);

  const handleTranscribeMessage = useCallback((message: TranscrbeMessage) => {
    match(message)
      .with({ status: "transcribing" }, (msg) => {
        // transcribing the file
        console.log("transcribing:", msg.tps, msg.chunks);
        //   setTranscript({
        //     isBusy: true,
        //     text: message.data.text,
        //     tps: message.data.tps,
        //     chunks: message.data.chunks
        //   });
        setIsBusy(true);
      })
      .with({ status: "error" }, ({ error }) => {
        setIsBusy(false);
        alert(
          `An error occurred: "${error.message}". Please file a bug report.`,
        );
      })
      .otherwise(() => {
        console.log("otherwise:", message);
      });
  }, []);

  const start = useCallback(
    async (audioData: AudioBuffer | undefined) => {
      if (audioData) {
        setIsBusy(true);
        let audio: Float32Array;
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
          audio: audio as AudioPipelineInputs,
          model: "onnx-community/whisper-tiny",
          language: "english",
          subtask: "transcribe",
          handleModelFilesMessage,
          handleTranscribeMessage,
        });
        if (result === null) return;

        setIsBusy(false);
        setTranscript(result);
      }
    },
    [handleModelFilesMessage, handleTranscribeMessage],
  );

  return { start, transcript, progressItems, isBusy };
}
