import React, { useState, useEffect } from "react";
import { Settings } from "lucide-react";

const canDetect = async (): Promise<TranslationAvailability> => {
  const canDetect123 = await window.translation.canDetect();
  console.log(1234, canDetect123);
  return canDetect123;
};

function App() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    canDetect();
    chrome.storage.sync.get(["count"], (result) => {
      setCount(result.count || 0);
    });
  }, []);

  const incrementCount = () => {
    const newCount = count + 1;
    setCount(newCount);
    chrome.storage.sync.set({ count: newCount });
  };

  return (
    <div className="w-64 p-4 bg-white">
      <h1 className="text-2xl font-bold mb-4">My Chrome Extension</h1>
      <div className="flex items-center justify-between mb-4">
        <p className="text-lg">Count: {count}</p>
        <button
          onClick={incrementCount}
          className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
        >
          Increment
        </button>
      </div>
      <div className="flex items-center text-gray-600">
        <Settings className="w-5 h-5 mr-2" />
        <span>Settings</span>
      </div>
    </div>
  );
}

export default App;
