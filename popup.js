document.getElementById('toggleButton').addEventListener('click', () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {action: "toggleTranscript"});
  });
});

document.getElementById('sendButton').addEventListener('click', () => {
  const chatInput = document.getElementById('chatInput');
  const message = chatInput.value.trim();
  if (message) {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {action: "sendChatMessage", message: message});
    });
    chatInput.value = '';
  }
});
