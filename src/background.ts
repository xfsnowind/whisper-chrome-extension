chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "startCapture") {
    console.log("startCapture sender", sender, request);
    startRecord(request.tab.id);
  }
});

async function startRecord(tabId: number) {
  // const existingContexts = await chrome.runtime.getContexts({});
  let recording = false;

  // const offscreenDocument = existingContexts.find((c) => c.contextType === "OFFSCREEN_DOCUMENT");

  // // If an offscreen document is not already open, create one.
  // if (!offscreenDocument) {
  //   // Create an offscreen document.
  //   await chrome.offscreen.createDocument({
  //     url: "offscreen.html",
  //     reasons: ["USER_MEDIA"],
  //     justification: "Recording from chrome.tabCapture API",
  //   });
  // } else {
  //   recording = offscreenDocument.documentUrl.endsWith("#recording");
  // }

  if (recording) {
    chrome.runtime.sendMessage({
      type: "stop-recording",
      target: "offscreen",
    });
    // chrome.action.setIcon({ path: "icons/not-recording.png" });
    return;
  }

  // Get a MediaStream for the active tab.
  const streamId = await chrome.tabCapture.getMediaStreamId({
    targetTabId: tabId,
  });
  console.log("streamid:", streamId);

  // Send the stream ID to the offscreen document to start recording.
  chrome.runtime.sendMessage({
    type: "start-recording",
    // target: "offscreen",
    data: streamId,
  });

  // chrome.action.setIcon({ path: "/icons/recording.png" });
}
