import { useTranscriber } from "./hooks/useTranscriber";

import Progress from "./components/Progress";
import FileTile from "./components/FileTile";
import FolderIcon from "@/assets/folder-icon.svg";
import { useEffect } from "react";
import useSummarize from "./hooks/useSummarize";

const IS_WEBGPU_AVAILABLE = !!navigator.gpu;

function App() {
  const transcriber = useTranscriber();

  const { initializeApplication } = useSummarize();

  useEffect(() => {
    if (!transcriber.isBusy && transcriber.transcript) {
      initializeApplication(transcriber.transcript.text);
    }
  }, [initializeApplication, transcriber.isBusy, transcriber.transcript]);

  if (transcriber.transcript) {
    console.log(transcriber.transcript);
  }

  return IS_WEBGPU_AVAILABLE ? (
    <div className="min-w-64 min-h-32 p-4 bg-white">
      <div className="flex flex-col items-center justify-between mb-4 ">
        <FileTile
          iconStr={FolderIcon}
          text="From file"
          onFileUpdate={(decoded) => {
            transcriber.start(decoded);
          }}
        />
        {transcriber.progressItems.length > 0 && (
          <div className="relative z-10 p-4 w-full text-center">
            <label>Loading model files... (only run once)</label>
            {transcriber.progressItems.map((data) => (
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
