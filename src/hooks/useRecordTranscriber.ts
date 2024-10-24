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
import { useCallback, useState } from "react";
import { match } from "ts-pattern";
import Constants from "../Constants";

class AutomaticSpeechRecognitionPipeline {
  static model_id: string | null = null;
  static tokenizer: Promise<PreTrainedTokenizer> | null = null;
  static processor: Promise<Processor> | null = null;
  static model: Promise<PreTrainedModel> | null = null;

  static async getInstance(progress_callback?: (data: Background.ModelFileMessage) => void) {
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
  continueRecordingTrigger,
}: Props & {
  audio: AudioPipelineInputs;
  handleTranscribeMessage: (message: Background.TranscrbeMessage) => void;
}) => {
  const [tokenizer, processor, model] = await AutomaticSpeechRecognitionPipeline.getInstance();

  let startTime;
  let numTokens = 0;
  let tps: number = 0;

  const streamer = new TextStreamer(tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (output: Background.Chunks) => {
      startTime ??= performance.now();

      if (numTokens++ > 0) {
        tps = (numTokens / (performance.now() - startTime)) * 1000;
        console.log("transcribing:", output);
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

  // NOTES: should be triggered after generate to request the new data
  continueRecordingTrigger();

  const outputText = tokenizer.batch_decode(outputs, { skip_special_tokens: true });
  return { chunks: outputText, tps };
};

const loadModelFiles = async ({
  handleModelFilesMessage,
}: {
  handleModelFilesMessage: (message: Background.ModelFileMessage) => void;
}) => {
  // Load the pipeline and save it for future use.
  // We also add a progress callback to the pipeline so that we can
  // track model loading.
  const [_tokenizer, _processor, model] =
    await AutomaticSpeechRecognitionPipeline.getInstance(handleModelFilesMessage);

  // Run model with dummy input to compile shaders
  await model.generate({
    input_features: full([1, 80, 3000], 0.0),
    max_new_tokens: 1,
    generation_config: {
      language: "chinese",
    },
  });

  handleModelFilesMessage({ status: "ready" });
};

type Props = {
  continueRecordingTrigger: () => void;
};

export function useAudioTranscriber({ continueRecordingTrigger }: Props) {
  const [transcript, setTranscript] = useState<
    | {
        tps: number;
        chunks: Array<string>;
      }
    | undefined
  >(undefined);
  const [isModelFilesReady, setIsModelFilesReady] = useState(false);
  const [progressItems, setProgressItems] = useState<Array<Background.ModelFileProgressItem>>([]);
  const [isBusy, setIsBusy] = useState(false);

  const handleModelFilesMessage = useCallback((message: Background.ModelFileMessage) => {
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

  const handleTranscribeMessage = useCallback((message: Background.TranscrbeMessage) => {
    match(message)
      .with({ status: "startAgain" }, { status: "completeChunk" }, () => {
        // sendMessageToMain(msg);
        return null;
      })
      .with({ status: "transcribing" }, () => {
        // transcribing the file
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
          continueRecordingTrigger,
        });

        if (result === null) return;

        setIsBusy(false);
        setTranscript(result);
      }
    },
    [continueRecordingTrigger, handleTranscribeMessage],
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
