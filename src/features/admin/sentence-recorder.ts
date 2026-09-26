const OUTPUT_SAMPLE_RATE = 16_000;

export async function recordedBlobToWav(source: Blob): Promise<Blob> {
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) throw new Error("Browser ini tidak dapat memproses rekaman mikrofon.");
  const context = new AudioContextClass();
  try {
    const decoded = await context.decodeAudioData(await source.arrayBuffer());
    const input = decoded.getChannelData(0);
    const ratio = decoded.sampleRate / OUTPUT_SAMPLE_RATE;
    const sampleCount = Math.floor(input.length / ratio);
    if (sampleCount < OUTPUT_SAMPLE_RATE / 2 || sampleCount > OUTPUT_SAMPLE_RATE * 30) {
      throw new Error("Panjang rekaman harus antara setengah detik dan 30 detik.");
    }
    const dataBytes = sampleCount * 2;
    const bytes = new ArrayBuffer(44 + dataBytes);
    const view = new DataView(bytes);
    const writeText = (offset: number, text: string) => {
      for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
    };
    writeText(0, "RIFF");
    view.setUint32(4, 36 + dataBytes, true);
    writeText(8, "WAVE");
    writeText(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, OUTPUT_SAMPLE_RATE, true);
    view.setUint32(28, OUTPUT_SAMPLE_RATE * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeText(36, "data");
    view.setUint32(40, dataBytes, true);
    for (let index = 0; index < sampleCount; index += 1) {
      const start = Math.floor(index * ratio);
      const end = Math.max(start + 1, Math.floor((index + 1) * ratio));
      let sum = 0;
      for (let sourceIndex = start; sourceIndex < Math.min(end, input.length); sourceIndex += 1) sum += input[sourceIndex];
      const sample = Math.max(-1, Math.min(1, sum / Math.max(1, Math.min(end, input.length) - start)));
      view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }
    return new Blob([bytes], { type: "audio/wav" });
  } finally {
    await context.close();
  }
}
