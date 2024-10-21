import {
  AudioPipelineInputs,
  AutoProcessor,
  AutoTokenizer,
  PreTrainedModel,
  PreTrainedTokenizer,
  Processor,
  TextStreamer,
  WhisperForConditionalGeneration,
  full,
} from "@huggingface/transformers";
import { useCallback, useRef, useState } from "react";
import { match } from "ts-pattern";
import {
  Chunks,
  ModelFileMessage,
  ModelFileProgressItem,
  TranscrbeMessage,
  TranscriberData,
} from "./type";
import Constants from "../utils/Constants";

class AutomaticSpeechRecognitionPipeline {
  static model_id: string | null = null;
  static tokenizer: Promise<PreTrainedTokenizer> | null = null;
  static processor: Promise<Processor> | null = null;
  static model: Promise<PreTrainedModel> | null = null;

  static async getInstance(progress_callback?: (data: ModelFileMessage) => void) {
    this.model_id = "onnx-community/whisper-base";

    this.tokenizer = AutoTokenizer.from_pretrained(this.model_id, {
      progress_callback,
    });
    this.processor = AutoProcessor.from_pretrained(this.model_id, {
      progress_callback,
    });

    this.model = WhisperForConditionalGeneration.from_pretrained(this.model_id, {
      dtype: {
        encoder_model: "fp32", // 'fp16' works too
        decoder_model_merged: "q4", // or 'fp32' ('fp16' is broken)
      },
      device: "webgpu",
      progress_callback,
    });

    return Promise.all([this.tokenizer, this.processor, this.model]);
  }
}

const transcribeRecord = async ({
  audio,
  handleTranscribeMessage,
}: {
  audio: AudioPipelineInputs;
  handleTranscribeMessage: (message: TranscrbeMessage) => void;
}) => {
  const [tokenizer, processor, model] = await AutomaticSpeechRecognitionPipeline.getInstance();

  let startTime;
  let numTokens = 0;
  let tps: number;

  const streamer = new TextStreamer(tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (output: any) => {
      startTime ??= performance.now();

      if (numTokens++ > 0) {
        tps = (numTokens / (performance.now() - startTime)) * 1000;
        handleTranscribeMessage({
          status: "transcribing",
          chunks: output,
          tps,
        });
      }
    },
  });

  const inputs = await processor(audio);

  const outputs = await model.generate({
    ...inputs,
    max_new_tokens: Constants.MAX_NEW_TOKENS,
    language: "chinese",
    streamer,
  });

  const outputText = tokenizer.batch_decode(outputs, { skip_special_tokens: true });
  console.log("outputText", outputText);
  return { chunks: outputText, tps };
};

const loadModelFiles = async ({
  handleModelFilesMessage,
}: {
  handleModelFilesMessage: (message: ModelFileMessage) => void;
}) => {
  // Load the pipeline and save it for future use.
  // We also add a progress callback to the pipeline so that we can
  // track model loading.
  const [tokenizer, processor, model] =
    await AutomaticSpeechRecognitionPipeline.getInstance(handleModelFilesMessage);

  // Run model with dummy input to compile shaders
  await model.generate({
    input_features: full([1, 80, 3000], 0.0),
    max_new_tokens: 1,
  });

  handleModelFilesMessage({ status: "ready" });
};

export function useAudioTranscriber() {
  const transcriberRef = useRef<AutomaticSpeechRecognitionPipeline | null>(null);
  const [transcript, setTranscript] = useState<
    | {
        tps: number;
        chunks: Chunks;
      }
    | undefined
  >(undefined);
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
      .with({ status: "ready" }, (msg) => {
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
    await loadModelFiles({ handleModelFilesMessage });
  }, [handleModelFilesMessage]);

  const start = useCallback(
    async (audioData: Float32Array | undefined) => {
      if (audioData) {
        setIsBusy(true);

        const result = await transcribeRecord({
          audio: audioData as AudioPipelineInputs,
          handleTranscribeMessage,
        });

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
