import { useTranscriber } from "./hooks/useTranscriber";

import Progress from "./components/Progress";
import FileTile from "./components/FileTile";
import FolderIcon from "@/assets/folder-icon.svg";
import { useCallback, useEffect, useRef, useState } from "react";
import useSummarize from "./hooks/useSummarize";
import Constants from "./utils/Constants";
import { useAudioTranscriber } from "./hooks/useRecordTranscriber";

const IS_WEBGPU_AVAILABLE = "gpu" in navigator && !!navigator.gpu;

function App() {
  const [audioData, setAudioData] = useState<
    { decoded: AudioBuffer; fileName: string } | undefined
  >(undefined);
  const [recordData, setRecordData] = useState<{ decoded: Float32Array } | undefined>(undefined);

  // const [isRecording, setIsRecording] = useState(false);
  // const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isValidUrl, setIsValidUrl] = useState(true);
  const [tab, setTab] = useState<chrome.tabs | null>(null);

  //record
  const [isRecording, setIsRecording] = useState(false);
  const [chunks, setChunks] = useState<Array<Blob>>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  // const { transcript, isBusy, start, initialize, progressItems, isModelFilesReady } =
  //   useTranscriber();

  const { transcript, isBusy, start, initialize, progressItems, isModelFilesReady } =
    useAudioTranscriber({
      continueRecordingTrigger: () => {
        recorderRef.current?.requestData();
      },
    });

  // const { initializeApplication } = useSummarize();

  // useEffect(() => {
  //   if (!isBusy && transcript) {
  //     initializeApplication(transcript.text);
  //   }
  // }, [initializeApplication, isBusy, transcript]);

  console.log("transcript:", transcript?.chunks);

  useEffect(() => {
    chrome.runtime.onMessage.addListener((request) => {
      if (request.type === "start-recording") {
        startRecording(request.data);
      }
    });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      setTab(currentTab);
      setIsValidUrl(!currentTab.url?.startsWith("chrome://"));
    });
  }, []);

  // const setAudioFromRecording = useCallback(async (data: Blob) => {
  //   resetAudio();
  //   setProgress(0);
  //   const blobUrl = URL.createObjectURL(data);
  //   const fileReader = new FileReader();
  //   fileReader.onprogress = (event) => {
  //     setProgress(event.loaded / event.total || 0);
  //   };
  //   fileReader.onloadend = async () => {
  //     const audioCTX = new AudioContext({
  //       sampleRate: Constants.SAMPLING_RATE,
  //     });
  //     const arrayBuffer = fileReader.result as ArrayBuffer;
  //     const decoded = await audioCTX.decodeAudioData(arrayBuffer);
  //     setProgress(undefined);
  //     setAudioData({
  //       decoded,
  //       // url: blobUrl,
  //       // mimeType: data.type,
  //     });
  //   };
  //   fileReader.readAsArrayBuffer(data);
  // }, []);

  const startCapture = () => {
    chrome.runtime.sendMessage({ action: "startCapture", tab: tab });
    // setIsRecording(true);
  };

  const stopCapture = () => {
    // chrome.runtime.sendMessage({ action: "stopCapture" });
    recorderRef.current?.stop();

    // Stopping the tracks makes sure the recording icon in the tab is removed.
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());

    recorderRef.current = null;
  };

  const startRecording = useCallback(async (streamId: number) => {
    // chrome.runtime.sendMessage({ action: "startCapture", tab: tab });
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

    // // Record the current state in the URL. This provides a very low-bandwidth
    // // way of communicating with the service worker (the service worker can check
    // // the URL of the document and see the current recording state). We can't
    // // store that directly in the service worker as it may be terminated while
    // // recording is in progress. We could write it to storage but that slightly
    // // increases the risk of things getting out of sync.
    // window.location.hash = "recording";
  }, []);

  // async function stopRecording() {
  //   recorder.stop();

  //   // Stopping the tracks makes sure the recording icon in the tab is removed.
  //   recorder.stream.getTracks().forEach((t) => t.stop());

  //   // Update current state in URL
  //   window.location.hash = "";

  //   // Note: In a real extension, you would want to write the recording to a more
  //   // permanent location (e.g IndexedDB) and then close the offscreen document,
  //   // to avoid keeping a document around unnecessarily. Here we avoid that to
  //   // make sure the browser keeps the Object URL we create (see above) and to
  //   // keep the sample fairly simple to follow.
  // }

  // useEffect(() => {
  //   if (recorderRef.current) return; // Already set

  //   if (navigator.mediaDevices.getUserMedia) {
  //     navigator.mediaDevices
  //       .getUserMedia({ audio: true })
  //       .then((stream) => {
  //         // setStream(stream);

  //         recorderRef.current = new MediaRecorder(stream);
  //         audioContextRef.current = new AudioContext({
  //           sampleRate: Constants.WHISPER_SAMPLING_RATE,
  //         });

  //         recorderRef.current.onstart = () => {
  //           setRecording(true);
  //           setChunks([]);
  //         };
  //         recorderRef.current.ondataavailable = (e) => {
  //           if (e.data.size > 0) {
  //             setChunks((prev) => [...prev, e.data]);
  //           } else {
  //             // Empty chunk received, so we request new data after a short timeout
  //             setTimeout(() => {
  //               recorderRef.current?.requestData();
  //             }, 25);
  //           }
  //         };

  //         recorderRef.current.onstop = () => {
  //           setRecording(false);
  //         };
  //       })
  //       .catch((err) => console.error("The following error occurred: ", err));
  //   } else {
  //     console.error("getUserMedia not supported on your browser!");
  //   }

  //   return () => {
  //     recorderRef.current?.stop();
  //     recorderRef.current = null;
  //   };
  // }, []);

  useEffect(() => {
    if (!recorderRef.current) return;
    if (!isRecording) return;

    if (chunks.length > 0) {
      // Generate from data
      const blob = new Blob(chunks, { type: recorderRef.current.mimeType });

      const fileReader = new FileReader();

      fileReader.onloadend = async () => {
        const arrayBuffer = fileReader.result;
        const decoded = await audioContextRef.current?.decodeAudioData(arrayBuffer);
        let audio = decoded.getChannelData(0);
        if (audio.length > Constants.MAX_SAMPLES) {
          // Get last MAX_SAMPLES
          audio = audio.slice(-Constants.MAX_SAMPLES);
        }

        // setRecordData({ decoded: audio });
        start(audio);
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
            <FileTile
              iconStr={FolderIcon}
              text="From file"
              onFileUpdate={(props) => {
                setAudioData(props);
              }}
            />
            {/* {audioData && (
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
            onClick={initialize}
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
