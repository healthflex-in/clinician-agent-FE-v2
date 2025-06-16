/**
 * Get user media (microphone)
 */
export const getUserMedia = async (): Promise<MediaStream> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return stream;
  } catch (err) {
    console.error('Error getting user media:', err);
    throw err;
  }
};

/**
 * Detect silence in audio stream
 */
export const detectSilence = (
  analyser: AnalyserNode,
  silenceThreshold: number,
  onSilenceDetected: () => void,
  detectionInterval: number = 100
): (() => void) => {
  let silenceStart: number | null = null;
  let cancelled = false;

  const checkSilence = () => {
    if (cancelled) return;

    const array = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(array);
    let values = 0;
    const length = array.length;
    for (let i = 0; i < length; i++) {
      values += array[i];
    }
    const average = values / length;

    if (average < silenceThreshold) {
      if (silenceStart === null) {
        silenceStart = Date.now();
      } else if (Date.now() - silenceStart > detectionInterval) {
        console.log('Silence detected');
        onSilenceDetected();
        silenceStart = null;
      }
    } else {
      silenceStart = null;
    }

    setTimeout(checkSilence, 100);
  };

  checkSilence();

  return () => {
    cancelled = true;
  };
};

/**
 * Resample audio buffer to a specific rate
 */
export const resampleAudio = async (audioBuffer: ArrayBuffer, targetSampleRate: number): Promise<ArrayBuffer> => {
  const audioContext = new AudioContext();
  const sourceBuffer = await audioContext.decodeAudioData(audioBuffer);
  const originalSampleRate = sourceBuffer.sampleRate;
  
  // If the sample rate is already correct, no need to resample
  if (originalSampleRate === targetSampleRate) {
    return sourceBuffer.getChannelData(0).buffer;
  }
  
  const duration = sourceBuffer.duration;
  const offlineContext = new OfflineAudioContext(
    1, // mono
    Math.ceil(duration * targetSampleRate),
    targetSampleRate
  );
  
  const source = offlineContext.createBufferSource();
  source.buffer = sourceBuffer;
  source.connect(offlineContext.destination);
  source.start(0);
  
  const renderedBuffer = await offlineContext.startRendering();
  return renderedBuffer.getChannelData(0).buffer;
};

/**
 * Encode audio buffer to WAV format with 16-bit PCM format
 */
export const encodeWAV = (audioBuffer: AudioBuffer): Blob => {
  const numChannels = 1; // Mono
  const sampleRate = audioBuffer.sampleRate;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  
  // Get audio data
  const channelData = audioBuffer.getChannelData(0);
  const dataSize = channelData.length * 2; // 16-bit = 2 bytes per sample
  
  // Create WAV header
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  
  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + dataSize, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  
  // Format chunk identifier
  writeString(view, 12, 'fmt ');
  // Format chunk length
  view.setUint32(16, 16, true);
  // Sample format (raw)
  view.setUint16(20, 1, true);
  // Channel count
  view.setUint16(22, numChannels, true);
  // Sample rate
  view.setUint32(24, sampleRate, true);
  // Byte rate (sample rate * block align)
  view.setUint32(28, byteRate, true);
  // Block align (channel count * bytes per sample)
  view.setUint16(32, blockAlign, true);
  // Bits per sample
  view.setUint16(34, bitsPerSample, true);
  
  // Data chunk identifier
  writeString(view, 36, 'data');
  // Data chunk length
  view.setUint32(40, dataSize, true);
  
  // Write the PCM samples - convert Float32 to Int16
  let offset = 44;
  for (let i = 0; i < channelData.length; i++) {
    // Clamp value between -1 and 1
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    // Convert to 16-bit signed integer
    const value = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(offset, value, true);
    offset += 2;
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
};

/**
 * Write a string to a DataView at the specified offset
 */
const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

/**
 * Convert a Blob to Base64 with data URL prefix
 */
export const blobToBase64 = async (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // Make sure we have the proper data URL prefix
      let base64 = reader.result as string;
      if (!base64.startsWith('data:')) {
        base64 = `data:audio/wav;base64,${base64.split(',')[1] || base64}`;
      }
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
