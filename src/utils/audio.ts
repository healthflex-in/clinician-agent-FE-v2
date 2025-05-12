
export function encodeWAV(audioBuffer: AudioBuffer): Blob {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bitsPerSample = 16;
  const channelData = audioBuffer.getChannelData(0);
  const bufferLength = channelData.length;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const wavBuffer = new ArrayBuffer(44 + bufferLength * 2);
  const view = new DataView(wavBuffer);

  function writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + bufferLength * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, bufferLength * 2, true);

  let offset = 44;
  for (let i = 0; i < bufferLength; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, channelData[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, s, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      resolve(base64.split(',')[1]); // Remove the data URL prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Function to resample audio to a target sample rate (usually 16000Hz)
export function resampleAudio(arrayBuffer: ArrayBuffer, targetSampleRate: number): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const audioContext = new AudioContext();
    
    audioContext.decodeAudioData(arrayBuffer).then(audioBuffer => {
      const numberOfChannels = audioBuffer.numberOfChannels;
      const duration = audioBuffer.duration;
      const offlineContext = new OfflineAudioContext(
        numberOfChannels,
        Math.ceil(duration * targetSampleRate),
        targetSampleRate
      );
      
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineContext.destination);
      source.start(0);
      
      offlineContext.startRendering()
        .then(renderedBuffer => resolve(renderedBuffer))
        .catch(err => {
          console.error('Offline rendering error:', err);
          reject(err);
        });
    }).catch(err => {
      console.error('Audio decoding error:', err);
      reject(err);
    });
  });
}

// Function to detect silence based on audio volume
export function detectSilence(
  analyser: AnalyserNode,
  silenceThreshold: number = -50,
  silenceCallback: () => void,
  silenceDuration: number = 5000,
): () => void {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  let silenceStart = null;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;

  const checkSilence = () => {
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate average volume level
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    const average = sum / bufferLength;
    const volumeDb = 20 * Math.log10(average / 255);

    if (volumeDb < silenceThreshold) {
      // Silent
      if (silenceStart === null) {
        silenceStart = Date.now();
      } else if (Date.now() - silenceStart >= silenceDuration) {
        if (silenceTimer === null) {
          silenceTimer = setTimeout(() => {
            silenceCallback();
            silenceStart = null;
            silenceTimer = null;
          }, 0);
        }
      }
    } else {
      // Not silent
      silenceStart = null;
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
    }
  };

  const intervalId = setInterval(checkSilence, 300);

  return () => {
    clearInterval(intervalId);
    if (silenceTimer) {
      clearTimeout(silenceTimer);
    }
  };
}

export function getUserMedia(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
}
