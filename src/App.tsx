import { useTranscriber } from "./useTranscriber";

import Progress from "./components/Progress";
import FileTile from "./components/FileTile";
import FolderIcon from "./assets/folder-icon.svg";

function App() {
  const transcriber = useTranscriber();

  return (
    <div className="w-64 p-4 bg-white">
      <div className="flex flex-col items-center justify-between mb-4 ">
        <FileTile
          icon={<FolderIcon />}
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
                <Progress text={data.file} percentage={data.progress} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
