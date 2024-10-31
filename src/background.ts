import {
  AudioPipelineInputs,
  AutoProcessor,
  AutoTokenizer,
  PreTrainedModel,
  PreTrainedTokenizer,
  Processor,
  Tensor,
  pipeline,
  TextStreamer,
  WhisperForConditionalGeneration,
  full,
} from "@huggingface/transformers";
import Constants from "./Constants";
import { match } from "ts-pattern";

const model = "onnx-community/whisper-large-v2";

async function checkModelsLoaded() {
  try {
    // Load the pipeline for automatic speech recognition
    const asrPipeline = await pipeline("automatic-speech-recognition", model, {
      dtype: {
        encoder_model: "fp32",
        // encoder_model: model === "onnx-community/whisper-large-v3-turbo" ? "fp16" : "fp32",
        decoder_model_merged: "q4", // or 'fp32' ('fp16' is broken)
      },
      device: "webgpu",
    });

    // Assuming you have an audio input as a Float32Array or other valid format
    const audioInput = new Float32Array([0.0, 0.1, 0.15, 0.2, 0.05, -0.05]);

    // Run the speech recognition model on the audio input
    const transcription = await asrPipeline(audioInput, { language: "english" });

    return !!transcription;
  } catch (error) {
    // Handle errors that occur during model loading
    console.error("Error loading the model:", error);
    return false;
  }
}

/************************************************************** Handle Auido data *****************************************************************/

class AutomaticSpeechRecognitionPipeline {
  static model_id: string | null = null;
  static tokenizer: Promise<PreTrainedTokenizer> | null = null;
  static processor: Promise<Processor> | null = null;
  static model: Promise<PreTrainedModel> | null = null;

  static async getInstance(progress_callback?: (data: Background.ModelFileMessage) => void) {
    this.model_id = model;

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

/************************************************************* Send Message to Main app ***********************************************************/

const sendMessageToMain = chrome.runtime.sendMessage<Background.MessageToMain>;

const handleModelFilesMessage = (message: Background.ModelFileMessage) => {
  match(message)
    .with(
      { status: "initiate" }, // initialize
      { status: "progress" }, // get the download pregress
      { status: "done" }, // done for one file
      { status: "ready" }, // all the model files are ready
      (msg) => {
        // Model file start load: add a new progress item to the list.
        sendMessageToMain(msg);
      },
    )
    .otherwise(() => null);
};

const loadModelFiles = async () => {
  // Load the pipeline and save it for future use.
  // We also add a progress callback to the pipeline so that we can
  // track model loading.

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_tokenizer, _processor, model] =
    await AutomaticSpeechRecognitionPipeline.getInstance(handleModelFilesMessage);

  // Run model with dummy input to compile shaders
  await model.generate({
    input_features: full([1, 80, 3000], 0.0),
    max_new_tokens: 1,
  });

  handleModelFilesMessage({ status: "ready" });
};

const handleTranscribeMessage = (message: Background.TranscrbeMessage) => {
  match(message)
    .with({ status: "startAgain" }, (msg) => {
      sendMessageToMain(msg);
    })
    .with({ status: "completeChunk" }, (msg) => {
      sendMessageToMain(msg);
    })
    .with({ status: "transcribing" }, () => {
      // transcribing the file
      //   setTranscript({
      //     isBusy: true,
      //     text: message.data.text,
      //     tps: message.data.tps,
      //     chunks: message.data.chunks
      //   });
    })
    .with({ status: "error" }, ({ error }) => {
      alert(`An error occurred: "${error.message}". Please file a bug report.`);
    })
    .exhaustive();
};

const transcribeRecord = async ({
  audio,
  language,
}: {
  audio: AudioPipelineInputs;
  language: string;
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
        handleTranscribeMessage({
          status: "transcribing",
          chunks: output,
          tps,
        });
      }
    },
  });

  // const d = audio as Float32Array;
  // console.log("audio, ", d.length);
  const inputs = await processor(audio);

  const outputs = await model.generate({
    ...inputs,
    max_new_tokens: Constants.MAX_NEW_TOKENS,
    language,
    streamer,
  });

  const outputText = tokenizer.batch_decode(outputs as Tensor, { skip_special_tokens: true });
  console.log("transcript:", outputText);
  return { chunks: outputText, tps };
};

async function startRecordTab(tabId: number) {
  const recording = false;

  if (recording) {
    sendMessageToMain({ status: "stop-recording" });
    return;
  }

  // Get a MediaStream for the active tab.
  chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
    // Send the stream ID to the offscreen document to start recording.
    sendMessageToMain({
      status: "start-recording-tab",
      data: streamId,
    });
  });
}

/********************************************************* Handle Message from Main ************************************************************/

chrome.runtime.onMessage.addListener((request: MainPage.MessageToBackground, sender) => {
  match(request)
    .with({ action: "checkModelsLoaded" }, async () => {
      const result = await checkModelsLoaded();
      sendMessageToMain({ status: "modelsLoaded", result });
    })
    .with({ action: "loadModels" }, () => {
      loadModelFiles();
    })
    .with({ action: "startCapture" }, ({ tab }) => {
      console.log("startCapture sender", sender, request);
      startRecordTab(tab.id);
    })
    .with({ action: "transcribe" }, async ({ data, language }) => {
      const audioData = new Float32Array(data);
      const result = await transcribeRecord({
        audio: audioData as AudioPipelineInputs,
        language,
      });

      if (result === null) return;

      sendMessageToMain({ status: "completeChunk", data: result });
    })
    .with({ action: "stopCapture" }, () => null)
    .exhaustive();
});
