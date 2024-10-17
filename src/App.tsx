import { useTranscriber } from "./hooks/useTranscriber";

import Progress from "./components/Progress";
import FileTile from "./components/FileTile";
import FolderIcon from "@/assets/folder-icon.svg";
import { useEffect } from "react";
import useSummarize from "./hooks/useSummarize";

const IS_WEBGPU_AVAILABLE = !!navigator.gpu;

function App() {
  const {
    transcript,
    isBusy,
    start,
    initialize,
    progressItems,
    isModelFilesReady,
  } = useTranscriber();

  const { initializeApplication } = useSummarize();

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
          "Model files loaded"
        ) : (
          <button
            className="flex items-center justify-center rounded-lg p-2 bg-blue text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200"
            onClick={initialize}
          >
            Load Models
          </button>
        )}
        <FileTile
          iconStr={FolderIcon}
          text="From file"
          onFileUpdate={(decoded) => {
            start(decoded);
          }}
        />

        {progressItems.length > 0 && (
          <div className="relative z-10 p-4 w-full text-center">
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
