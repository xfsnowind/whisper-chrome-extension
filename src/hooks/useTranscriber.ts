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
import { useCallback, useRef, useState } from "react";
import { match } from "ts-pattern";
import { ModelFileMessage, ModelFileProgressItem, TranscrbeMessage, TranscriberData } from "./type";

// Define model factories
// Ensures only one model is created of each type
class PipelineFactory {
  static task: PipelineType | null = null;
  static model: string | undefined = undefined;
  static instance: Promise<AllTasks[keyof AllTasks]> | null;
  static tokenizer: PreTrainedTokenizer | null = null;

  static async getInstance(handleModelFilesCallback?: (data: ModelFileMessage) => void) {
    if (this.task === null) {
      throw new Error("The task has not been set");
    }
    if (this.instance === null) {
      this.instance = pipeline(this.task, this.model, {
        dtype: {
          encoder_model: this.model === "onnx-community/whisper-large-v3-turbo" ? "fp16" : "fp32",
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

const getTranscriberInstance = async ({
  model,
  handleModelFilesMessage,
}: {
  model: string;
  handleModelFilesMessage: (message: ModelFileMessage) => void;
}) => {
  if (AutomaticSpeechRecognitionPipelineFactory.model !== model) {
    // Invalidate model if different
    AutomaticSpeechRecognitionPipelineFactory.model = model;

    if (AutomaticSpeechRecognitionPipelineFactory.instance !== null) {
      const instance =
        (await AutomaticSpeechRecognitionPipelineFactory.getInstance()) as AutomaticSpeechRecognitionPipeline;
      instance?.dispose();
      AutomaticSpeechRecognitionPipelineFactory.instance = null;
    }
  }

  // Load transcriber model
  console.log("Load transcriber model");
  const instance =
    await AutomaticSpeechRecognitionPipelineFactory.getInstance(handleModelFilesMessage);
  return instance as AutomaticSpeechRecognitionPipeline;
};

const transcribeAudio = async ({
  audio,
  model,
  subtask,
  language,
  transcriber,
  handleTranscribeMessage,
}: {
  audio: AudioPipelineInputs;
  language: string;
  subtask: string;
  model: string;
  transcriber: AutomaticSpeechRecognitionPipeline;
  handleTranscribeMessage: (message: TranscrbeMessage) => void;
}) => {
  const isDistilWhisper = model.startsWith("distil-whisper/");

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
  let tps: number = 0;

  console.log("before stream: time_precision", time_precision);
  const streamer = new WhisperTextStreamer(transcriber.tokenizer as WhisperTokenizer, {
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
    streamer, // after each generation step
  }).catch((error: Error) => {
    console.error(error);
    handleTranscribeMessage({ status: "error", error });
    return null;
  });

  return output ? { ...output, tps } : null;
};

export function useTranscriber() {
  const transcriberRef = useRef<AutomaticSpeechRecognitionPipeline | null>(null);
  const [transcript, setTranscript] = useState<TranscriberData | undefined>(undefined);
  const [isModelFilesReady, setIsModelFilesReady] = useState(false);
  const [progressItems, setProgressItems] = useState<Array<ModelFileProgressItem>>([]);
  const [isBusy, setIsBusy] = useState(false);

  const handleModelFilesMessage = useCallback((message: ModelFileMessage) => {
    match(message)
      .with({ status: "initiate" }, (msg) => {
        // Model file start load: add a new progress item to the list.
        setProgressItems((prev) => [...prev, msg]);
      })
      .with({ status: "progress" }, (msg) => {
        // loading the model file
        // Model file progress: update one of the progress items.
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
        setProgressItems((prev) => prev.filter((item) => item.file !== msg.file));
      })
      .with({ status: "ready" }, () => {
        // all the model files are ready
        setIsModelFilesReady(true);
      })
      .otherwise(() => null);
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
        alert(`An error occurred: "${error.message}". Please file a bug report.`);
      })
      .exhaustive();
  }, []);

  const initialize = useCallback(async () => {
    const transcriberInstance = await getTranscriberInstance({
      model: "onnx-community/whisper-tiny",
      handleModelFilesMessage,
    });
    console.log("transcriberInstance", transcriberInstance);
    transcriberRef.current = transcriberInstance;
  }, [handleModelFilesMessage]);

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

        let result = null;

        if (transcriberRef.current) {
          result = await transcribeAudio({
            transcriber: transcriberRef.current,
            audio: audio as AudioPipelineInputs,
            model: "onnx-community/whisper-tiny",
            language: "english",
            subtask: "transcribe",
            handleTranscribeMessage,
          });
        } else {
          alert("Model hasn't been initialized!");
        }
        if (result === null) return;

        setIsBusy(false);
        setTranscript(result);
      }
    },
    [handleTranscribeMessage, transcriberRef],
  );

  return {
    start,
    transcript,
    progressItems,
    isBusy,
    initialize,
    isModelFilesReady,
  };
}
