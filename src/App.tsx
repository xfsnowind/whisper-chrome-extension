import { useTranscriber } from "./useTranscriber";

import Progress from "./components/Progress";
function App() {
  const transcriber = useTranscriber();

  console.log("result", transcriber.transcript);

  return (
    <div className="w-64 p-4 bg-white">
      <div className="flex items-center justify-between mb-4">
        <FileTile
          icon={<FolderIcon />}
          text="From file"
          onFileUpdate={(decoded, blobUrl, mimeType) => {
            // props.transcriber.onInputChange();
            // setAudioData({
            //   buffer: decoded,
            //   url: blobUrl,
            //   mimeType: mimeType
            // });
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

const SAMPLING_RATE = 16000;

function FolderIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"
      />
    </svg>
  );
}

function FileTile(props: {
  icon: JSX.Element;
  text: string;
  onFileUpdate: (
    decoded: AudioBuffer,
    blobUrl: string,
    mimeType: string
  ) => void;
}) {
  // Create hidden input element
  const elem = document.createElement("input");
  elem.type = "file";
  elem.oninput = (event) => {
    // Make sure we have files to use
    const files = (event.target as HTMLInputElement).files;
    if (!files) return;

    // Create a blob that we can use as an src for our audio element
    const urlObj = URL.createObjectURL(files[0]);
    const mimeType = files[0].type;

    const reader = new FileReader();
    reader.addEventListener("load", async (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer; // Get the ArrayBuffer
      if (!arrayBuffer) return;

      const audioCTX = new AudioContext({
        sampleRate: SAMPLING_RATE
      });

      const decoded = await audioCTX.decodeAudioData(arrayBuffer);

      props.onFileUpdate(decoded, urlObj, mimeType);
    });
    reader.readAsArrayBuffer(files[0]);

    // Reset files
    elem.value = "";
  };

  return (
    <Tile icon={props.icon} text={props.text} onClick={() => elem.click()} />
  );
}

function Tile(props: {
  icon: JSX.Element;
  text?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={props.onClick}
      className="flex items-center justify-center rounded-lg p-2 bg-blue text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200"
    >
      <div className="w-7 h-7">{props.icon}</div>
      {props.text && (
        <div className="ml-2 break-text text-center text-md w-30">
          {props.text}
        </div>
      )}
    </button>
  );
}
