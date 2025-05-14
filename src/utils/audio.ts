
/**
 * Get user media (microphone access)
 */
export function getUserMedia(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });
}

/**
 * Detect silence in an audio stream
 */
export function detectSilence(
  analyser: AnalyserNode, 
  silenceThreshold: number, 
  onSilence: () => void, 
  silenceDuration: number = 3000
): () => void {
  const dataArray = new Uint8Array(analyser.fftSize);
  let silenceStart: number | null = null;
  let timeout: number | null = null;
  
  const checkSilence = () => {
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate average volume
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    
    if (average < silenceThreshold) {
      // Silence detected
      if (silenceStart === null) {
        silenceStart = Date.now();
      } else if (Date.now() - silenceStart > silenceDuration) {
        // Silence has lasted long enough, stop recording
        onSilence();
        return;
      }
    } else {
      // Reset silence detection
      silenceStart = null;
    }
    
    // Continue checking
    timeout = window.setTimeout(checkSilence, 100);
  };
  
  // Start the detection
  checkSilence();
  
  // Return a cleanup function
  return () => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
  };
}

/**
 * Resample audio to the specified sample rate
 */
export async function resampleAudio(buffer: ArrayBuffer, targetSampleRate: number): Promise<AudioBuffer> {
  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(buffer);
  
  const originalSampleRate = audioBuffer.sampleRate;
  
  if (originalSampleRate === targetSampleRate) {
    return audioBuffer;
  }
  
  const channelCount = audioBuffer.numberOfChannels;
  const frameCount = (audioBuffer.length * targetSampleRate) / originalSampleRate;
  
  const resampledBuffer = audioCtx.createBuffer(
    channelCount,
    frameCount,
    targetSampleRate
  );
  
  for (let channel = 0; channel < channelCount; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = resampledBuffer.getChannelData(channel);
    
    // Simple linear interpolation resampling
    const stepSize = originalSampleRate / targetSampleRate;
    
    for (let i = 0; i < frameCount; i++) {
      const position = i * stepSize;
      const index = Math.floor(position);
      const fraction = position - index;
      
      if (index + 1 < inputData.length) {
        outputData[i] = inputData[index] * (1 - fraction) + inputData[index + 1] * fraction;
      } else {
        outputData[i] = inputData[index];
      }
    }
  }
  
  return resampledBuffer;
}

/**
 * Encode audio buffer to WAV format
 */
export function encodeWAV(audioBuffer: AudioBuffer): Blob {
  const interleaved = interleaveChannels(audioBuffer);
  const dataView = encodeWAVHeader(interleaved, audioBuffer.sampleRate);
  return new Blob([dataView], { type: 'audio/wav' });
}

function interleaveChannels(audioBuffer: AudioBuffer): Float32Array {
  const channelCount = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const result = new Float32Array(length * channelCount);
  
  for (let channel = 0; channel < channelCount; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      result[i * channelCount + channel] = channelData[i];
    }
  }
  
  return result;
}

function encodeWAVHeader(samples: Float32Array, sampleRate: number): DataView {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const channels = 1; // Mono
  const bitDepth = 16;
  
  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + samples.length * 2, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // Format chunk identifier
  writeString(view, 12, 'fmt ');
  // Format chunk length
  view.setUint32(16, 16, true);
  // Sample format (1 is PCM)
  view.setUint16(20, 1, true);
  // Channel count
  view.setUint16(22, channels, true);
  // Sample rate
  view.setUint32(24, sampleRate, true);
  // Byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * channels * (bitDepth / 8), true);
  // Block align (channel count * bytes per sample)
  view.setUint16(32, channels * (bitDepth / 8), true);
  // Bits per sample
  view.setUint16(34, bitDepth, true);
  // Data chunk identifier
  writeString(view, 36, 'data');
  // Data chunk length
  view.setUint32(40, samples.length * 2, true);
  
  // Write the PCM samples
  floatTo16BitPCM(view, 44, samples);
  
  return view;
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array): void {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

// Updated to ensure we include the data URL prefix before the base64 data
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Return the full data URL instead of just the base64 part
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
