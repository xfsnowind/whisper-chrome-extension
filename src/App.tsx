// import { useTranscriber } from "./hooks/useTranscriber";

import Progress from "./components/Progress";
// import FileTile from "./components/FileTile";
// import FolderIcon from "@/assets/folder-icon.svg";
import { useCallback, useEffect, useRef, useState } from "react";
// import useSummarize from "./hooks/useSummarize";
import Constants from "./Constants";
import { match } from "ts-pattern";

const IS_WEBGPU_AVAILABLE = "gpu" in navigator && !!navigator.gpu;

const sendMessageToBackground = chrome.runtime.sendMessage<MainPage.MessageToBackground>;

function App() {
  // const [audioData, setAudioData] = useState<
  //   { decoded: AudioBuffer; fileName: string } | undefined
  // >(undefined);
  // const [recordData, setRecordData] = useState<{ decoded: Float32Array } | undefined>(undefined);

  const [transcript, setTranscript] = useState<Array<string>>([]);

  // NOTES: model files
  const [progressItems, setProgressItems] = useState<Array<Background.ModelFileProgressItem>>([]);
  const [isModelFilesReady, setIsModelFilesReady] = useState(false);

  // const [isRecording, setIsRecording] = useState(false);
  const [isValidUrl, setIsValidUrl] = useState(true);
  const [tab, setTab] = useState<MainPage.ChromeTab | null>(null);

  // NOTES: record
  const [isRecording, setIsRecording] = useState(false);
  const [chunks, setChunks] = useState<Array<Blob>>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  // const { transcript, isBusy, start, initialize, progressItems, isModelFilesReady } =
  //   useTranscriber();

  // const { initializeApplication } = useSummarize();

  // useEffect(() => {
  //   if (!isBusy && transcript) {
  //     initializeApplication(transcript.text);
  //   }
  // }, [initializeApplication, isBusy, transcript]);

  console.log("transcript:", transcript);

  const startRecording = useCallback(async (streamId: string) => {
    if (recorderRef.current?.state === "recording") {
      throw new Error("Called startRecording while recording is in progress.");
    }

    const media = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      },
      // video: {
      //   mandatory: {
      //     chromeMediaSource: "tab",
      //     chromeMediaSourceId: streamId,
      //   },
      // },
    });

    // Continue to play the captured audio to the user.
    audioContextRef.current = new AudioContext({
      sampleRate: Constants.WHISPER_SAMPLING_RATE,
    });
    const source = audioContextRef.current.createMediaStreamSource(media);
    source.connect(audioContextRef.current.destination);

    // Start recording.
    recorderRef.current = new MediaRecorder(media, { mimeType: "video/webm" });
    recorderRef.current.onstart = () => {
      setIsRecording(true);
      setChunks([]);
    };
    recorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        setChunks((prev) => [...prev, event.data]);
      } else {
        // Empty chunk received, so we request new data after a short timeout
        setTimeout(() => {
          recorderRef.current?.requestData();
        }, 25);
      }
    };
    recorderRef.current.onstop = () => {
      console.log("stop");
      setIsRecording(false);
    };
    recorderRef.current.start();
  }, []);

  useEffect(() => {
    const receiveMessageFromBackground = (messageFromBg: Background.MessageToMain) => {
      match(messageFromBg)
        .with({ status: "start-recording-tab" }, ({ data: streamId }) => {
          console.log("receive streamId:", streamId);
          startRecording(streamId);
        })
        .with({ status: "startAgain" }, () => {
          recorderRef.current?.requestData();
        })
        .with({ status: "completeChunk" }, ({ data }) => {
          setTranscript(data.chunks);
        })
        // model files
        .with({ status: "initiate" }, (data) => {
          setProgressItems((prev) => [...prev, data]);
        })
        .with({ status: "progress" }, ({ progress, file }) => {
          // Model file progress: update one of the progress items.
          setProgressItems((prev) =>
            prev.map((item) => {
              if (item.file === file) {
                return { ...item, progress, file };
              }
              return item;
            }),
          );
        })
        .with({ status: "done" }, ({ file }) => {
          // Model file loaded: remove the progress item from the list.
          setProgressItems((prev) => prev.filter((item) => item.file !== file));
        })
        .with({ status: "ready" }, () => {
          setIsModelFilesReady(true);
        });
    };

    chrome.runtime.onMessage.addListener(receiveMessageFromBackground);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      setTab(currentTab);
      setIsValidUrl(!currentTab.url?.startsWith("chrome://"));
    });

    return () => {
      chrome.runtime.onMessage.removeListener(receiveMessageFromBackground);
    };
  }, [startRecording]);

  const startCapture = () => {
    if (tab) {
      sendMessageToBackground({ action: "startCapture", tab });
    }
    // setIsRecording(true);
  };

  const stopCapture = () => {
    recorderRef.current?.stop();

    // Stopping the tracks makes sure the recording icon in the tab is removed.
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());

    recorderRef.current = null;
  };

  useEffect(() => {
    if (!recorderRef.current) return;
    if (!isRecording) return;

    if (chunks.length > 0) {
      // Generate from data
      const blob = new Blob(chunks, { type: recorderRef.current.mimeType });

      const fileReader = new FileReader();

      fileReader.onloadend = async () => {
        const arrayBuffer = fileReader.result;
        if (arrayBuffer) {
          const decoded = await audioContextRef.current?.decodeAudioData(
            arrayBuffer as ArrayBuffer,
          );
          if (decoded) {
            let audio = decoded.getChannelData(0);
            if (audio.length > Constants.MAX_SAMPLES) {
              // Get last MAX_SAMPLES
              audio = audio.slice(-Constants.MAX_SAMPLES);
            }

            const serializedAudioData = Array.from(audio);
            sendMessageToBackground({ data: serializedAudioData, action: "transcribe" });
          }
        }
      };
      fileReader.readAsArrayBuffer(blob);
    } else {
      recorderRef.current?.requestData();
    }
  }, [isRecording, chunks]);

  return IS_WEBGPU_AVAILABLE ? (
    <div className="min-w-64 min-h-32 p-4 bg-white">
      <div className="flex flex-col items-center justify-between mb-4 ">
        {isModelFilesReady ? (
          <div className="flex flex-col items-center justify-between mb-4">
            Model files loaded
            {/* <FileTile
              iconStr={FolderIcon}
              text="From file"
              onFileUpdate={(props) => {
                setAudioData(props);
              }}
            />
             {audioData && (
              <div className="flex flex-col items-center justify-between mb-4">
                File Name: {audioData.fileName}
                <button
                  className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 my-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center mr-2 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 inline-flex items-center"
                  onClick={() => start(audioData.decoded)}
                >
                  Transcribe
                </button>
              </div>
            )} */}
            {isRecording ? (
              <button
                className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 my-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center mr-2 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 inline-flex items-center"
                onClick={() => stopCapture()}
              >
                Stop Record
              </button>
            ) : (
              <button
                className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 my-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center mr-2 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 inline-flex items-center"
                onClick={() => startCapture()}
              >
                Record
              </button>
            )}
            {/* {recordData && (
              <div className="flex flex-col items-center justify-between mb-4">
                <button
                  className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 my-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center mr-2 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 inline-flex items-center"
                  onClick={() => start(recordData.decoded)}
                >
                  Transcribe
                </button>
              </div>
            )} */}
          </div>
        ) : (
          <button
            className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center mr-2 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 inline-flex items-center"
            onClick={() => sendMessageToBackground({ action: "loadModels" })}
          >
            Load Models
          </button>
        )}

        {progressItems.length > 0 && (
          <div className="relative z-10 p-4 w-full text-center">
            <VerticalBar />
            <label>Loading model files... (only run once)</label>
            {progressItems.map((data) => (
              <div key={data.file}>
                <Progress
                  text={data.file}
                  percentage={data.progress}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  ) : (
    <div className="fixed w-screen h-screen bg-black z-10 bg-opacity-[92%] text-white text-2xl font-semibold flex justify-center items-center text-center">
      WebGPU is not supported
      <br />
      by this browser :&#40;
    </div>
  );
}

export default App;

function VerticalBar() {
  return <div className="w-[1px] bg-slate-200"></div>;
}
