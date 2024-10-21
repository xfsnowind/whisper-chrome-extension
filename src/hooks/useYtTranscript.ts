export default function useYtTranscript() {
  
      const transcriptButton = document.querySelector('button[aria-label="Show transcript"]');
    
      if (!transcriptButton) {
        console.log("none");
        return "none";
      }
    
      transcriptButton.click();
    let transcript = ""
      setTimeout(() => {
        const transcriptSegments = document.querySelectorAll('ytd-transcript-segment-renderer');
        
        if (transcriptSegments.length === 0) {
          console.log("none");
          return "none";
        }
    
        transcript = Array.from(transcriptSegments).map(segment => {
          // Try multiple selectors for timestamp
          const timestampElement = 
            segment.querySelector('.segment-timestamp') || 
            segment.querySelector('.segment-start-offset') ||
            segment.querySelector('[id="timestamp"]');
          const timestamp = timestampElement ? timestampElement.textContent.trim() : 'N/A';
          
          // Try multiple selectors for text
          const textElement = 
            segment.querySelector('.segment-text') || 
            segment.querySelector('yt-formatted-string.ytd-transcript-segment-renderer') ||
            segment.querySelector('[id="segment-text"]');
          
          const text = textElement ? textElement.textContent.trim() : 'N/A';
          
          return `[${timestamp}] ${text}`;
        }).join('\n');
    
        console.log(transcript);
    
      }, 1500); // Increased tim
      return transcript
    }


