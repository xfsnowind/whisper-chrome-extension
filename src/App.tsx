import { useTranscriber } from "./hooks/useTranscriber";

import Progress from "./components/Progress";
import FileTile from "./components/FileTile";
import FolderIcon from "@/assets/folder-icon.svg";
import { useEffect, useState } from "react";
import useSummarize from "./hooks/useSummarize";
import usePrompt from "./hooks/usePrompt";
import useYtTranscript from "./hooks/useYtTranscript";

const IS_WEBGPU_AVAILABLE = "gpu" in navigator && !!navigator.gpu;

function App() {
  const [audioData, setAudioData] = useState<
    { decoded: AudioBuffer; fileName: string } | undefined
  >(undefined);

  const {
    transcript,
    isBusy,
    start,
    initialize,
    progressItems,
    isModelFilesReady,
  } = useTranscriber();

  const { initializeApplication } = useSummarize();
  const {createPromptSession} = usePrompt();
  

 


  useEffect(() => {
    const ytTranscript = useYtTranscript();
    createPromptSession(ytTranscript);
    
    console.log(1234);
    
  }, [createPromptSession]);

  useEffect(() => {
    if (!isBusy && transcript) {
      initializeApplication(transcript.text);
    }
  }, [initializeApplication, isBusy, transcript]);

  if (transcript) {
    console.log(transcript);
  }

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
            )}
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
                <Progress text={data.file} percentage={data.progress} />
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
