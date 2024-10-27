let transcriptPanel: HTMLElement | null = null;

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
  const transcriptButton = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Show transcript"]',
  );

  if (transcriptButton) {
    transcriptButton.click();
    setTimeout(() => {
      const transcriptItems = document.querySelectorAll<HTMLElement>(
        "yt-formatted-string.ytd-transcript-segment-renderer",
      );
      let transcriptText = "";
      transcriptItems.forEach((item) => {
        if (item.textContent) {
          transcriptText += item.textContent + "\n\n";
        }
      });

      if (transcriptPanel) {
        transcriptPanel.innerHTML = `
          <h3>Chat with AI</h3>
          <div id="chatMessages"></div>
          <h2>Transcript</h2>
          <pre>${transcriptText}</pre>
        `;
      }

      const closeTranscriptButton = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Close transcript"]',
      );
      if (closeTranscriptButton) {
        closeTranscriptButton.click();
      }
    }, 1000);
  } else if (transcriptPanel) {
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

function addChatMessage(message: string, isAI: boolean = false) {
  if (transcriptPanel) {
    const chatMessages = transcriptPanel.querySelector<HTMLElement>("#chatMessages");
    if (chatMessages) {
      const messageElement = document.createElement("p");
      messageElement.textContent = `${isAI ? "AI: " : "You: "}${message}`;
      messageElement.style.marginBottom = "5px";
      chatMessages.appendChild(messageElement);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }
}

// Type for the request object that is passed by chrome.runtime.onMessage
interface MessageRequest {
  action: string;
  message?: string;
}

chrome.runtime.onMessage.addListener((request: MessageRequest) => {
  if (request.action === "toggleTranscript") {
    toggleTranscript();
  } else if (request.action === "sendChatMessage" && request.message) {
    addChatMessage(request.message);
    // Mock AI reply
    setTimeout(() => {
      addChatMessage("111", true);
    }, 500);
  }
});
