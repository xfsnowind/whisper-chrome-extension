let transcriptPanel = null;

function createTranscriptPanel() {
  transcriptPanel = document.createElement("div");
  transcriptPanel.id = "yt-transcript-panel";
  transcriptPanel.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 300px;
    height: 100%;
    background-color: white;
    overflow-y: auto;
    z-index: 9999;
    padding: 20px;
    box-shadow: -2px 0 5px rgba(0,0,0,0.2);
  `;
  document.body.appendChild(transcriptPanel);
}

function extractTranscript() {
  const transcriptButton = document.querySelector('button[aria-label="Show transcript"]');
  if (transcriptButton) {
    transcriptButton.click();
    setTimeout(() => {
      const transcriptItems = document.querySelectorAll(
        "yt-formatted-string.ytd-transcript-segment-renderer",
      );
      let transcriptText = "";
      transcriptItems.forEach((item) => {
        transcriptText += item.textContent + "\n\n";
      });
      transcriptPanel.innerHTML = `
        <h3>Chat with AI</h3>
        <div id="chatMessages"></div>
        <h2>Transcript</h2>
        <pre>${transcriptText}</pre>
      `;
      const closeTranscriptButton = document.querySelector('button[aria-label="Close transcript"]');
      if (closeTranscriptButton) {
        closeTranscriptButton.click();
      }
    }, 1000);
  } else {
    transcriptPanel.innerHTML = `
      <h3>Chat with AI</h3>
      <div id="chatMessages"></div>
      <h2>Transcript</h2>
      <p>No transcript available for this video.</p>
    `;
  }
}

function toggleTranscript() {
  if (!transcriptPanel) {
    createTranscriptPanel();
    extractTranscript();
  } else {
    transcriptPanel.remove();
    transcriptPanel = null;
  }
}

function addChatMessage(message, isAI = false) {
  if (transcriptPanel) {
    const chatMessages = transcriptPanel.querySelector("#chatMessages");
    const messageElement = document.createElement("p");
    messageElement.textContent = `${isAI ? "AI: " : "You: "}${message}`;
    messageElement.style.marginBottom = "5px";
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "toggleTranscript") {
    toggleTranscript();
  } else if (request.action === "sendChatMessage") {
    addChatMessage(request.message);
    // Mock AI reply
    setTimeout(() => {
      addChatMessage("111", true);
    }, 500);
  }
});
