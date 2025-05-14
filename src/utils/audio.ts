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
  const sourceData = sourceBuffer.getChannelData(0);
  const sourceSampleRate = audioContext.sampleRate;
  
  const bufferLength = sourceBuffer.length;
  const targetLength = bufferLength * (targetSampleRate / sourceSampleRate);
  const resampledBuffer = audioContext.createBuffer(1, targetLength, targetSampleRate);
  const resampledData = resampledBuffer.getChannelData(0);
  
  let offset = 0;
  for (let i = 0; i < targetLength; i++) {
    const sourceOffset = offset * (sourceSampleRate / targetSampleRate);
    const sourceOffsetFloor = Math.floor(sourceOffset);
    const sourceOffsetCeil = Math.ceil(sourceOffset);
    const sourceOffsetDecimal = sourceOffset - sourceOffsetFloor;
    
    if (sourceOffsetCeil < bufferLength) {
      resampledData[i] = sourceData[sourceOffsetFloor] * (1 - sourceOffsetDecimal) + sourceData[sourceOffsetCeil] * sourceOffsetDecimal;
    } else {
      resampledData[i] = sourceData[sourceOffsetFloor];
    }
    offset++;
  }
  
  return resampledBuffer.getChannelData(0).buffer;
};

/**
 * Encode audio buffer to WAV format
 */
export const encodeWAV = (audioBuffer: ArrayBuffer): Blob => {
  const numChannels = 1;
  const sampleRate = 16000; // Fixed sample rate
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = audioBuffer.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF size */
  view.setUint32(4, 36 + dataSize, true);
  /* RIFF format */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk byte count */
  view.setUint32(16, 16, true);
  /* format code (PCM = 1) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, byteRate, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, bitsPerSample, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk byte count */
  view.setUint32(40, dataSize, true);

  /* PCM data */
  const dataView = new DataView(audioBuffer);
  for (let i = 0; i < dataSize; i++) {
    view.setUint8(44 + i, dataView.getUint8(i));
  }

  return new Blob([view], { type: 'audio/wav' });
};

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
