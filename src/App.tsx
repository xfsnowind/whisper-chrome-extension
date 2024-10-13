import { useEffect } from "react";
import useSummarize from "./useSummarize";

function App() {
  const { initializeApplication } = useSummarize();

  useEffect(() => {
    initializeApplication();
  }, [initializeApplication]);

  return (
    <div className="w-64 p-4 bg-white">
      <div className="flex items-center justify-between mb-4"></div>
    </div>
  );
}

export default App;
