export default function FileTile(props: {
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
      <div className="w-7 h-7">
        <svg dangerouslySetInnerHTML={{ __html: props.icon }} />
      </div>
      {props.text && (
        <div className="ml-2 break-text text-center text-md w-30">
          {props.text}
        </div>
      )}
    </button>
  );
}

const SAMPLING_RATE = 16000;
