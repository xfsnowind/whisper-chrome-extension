const WHISPER_SAMPLING_RATE = 16_000;
const MAX_AUDIO_LENGTH = 30; // seconds

export default {
  SAMPLING_RATE: 16000,

  DEFAULT_SUBTASK: "transcribe",
  DEFAULT_LANGUAGE: "english",
  DEFAULT_MULTILINGUAL: true,

  WHISPER_SAMPLING_RATE,
  MAX_AUDIO_LENGTH, // seconds
  MAX_SAMPLES: WHISPER_SAMPLING_RATE * MAX_AUDIO_LENGTH,
  MAX_NEW_TOKENS: 64,
};