// ===== EXPORT (our addition, not part of the Mario Jazz tutorial) =====
// After the music starts, two buttons appear:
//   Download WAV  -> the music as an audio file (rendered offline, so it's quick)
//   Download MIDI -> the same notes as a MIDI file (open it in GarageBand for nicer sounds)
// Both export exactly the tokens that were just played (playedTokens in sketch.js).

function showExportButtons() {
  createButton("Download WAV").position(10, height + 20).mousePressed(exportWav);
  createButton("Download MIDI").position(130, height + 20).mousePressed(exportMidi);
}

// ---------- WAV ----------

async function exportWav() {
  let notes = convertTokensToNotes(playedTokens);
  let bpm = Tone.Transport.bpm.value;
  let sixteenthSec = 60 / bpm / 4;
  let totalSixteenths = playedTokens.reduce((sum, t) => sum + parseInt(t.split(":")[1], 10), 0);
  let seconds = totalSixteenths * sixteenthSec + 2; // +2 s so the last note can fade out

  // Render the same notes again, silently and faster than real time.
  // NOTE: if you change the synth in sketch.js, change it here too so the export sounds the same.
  let buffer = await Tone.Offline(({ transport }) => {
    transport.bpm.value = bpm;
    let offlineSynth = new Tone.Synth().toDestination();
    new Tone.Part((time, note) => {
      let length = parseInt(note.duration, 10) * sixteenthSec;
      offlineSynth.triggerAttackRelease(note.pitch, length, time, 0.5);
    }, notes).start(0);
    transport.start();
  }, seconds);

  downloadFile(audioBufferToWav(buffer.get()), "markov-bass.wav");
}

// Turn the rendered audio into a standard 16-bit WAV file
function audioBufferToWav(audioBuffer) {
  let channels = audioBuffer.numberOfChannels;
  let rate = audioBuffer.sampleRate;
  let length = audioBuffer.length;
  let dataSize = length * channels * 2;
  let view = new DataView(new ArrayBuffer(44 + dataSize));
  let writeText = (pos, s) => { for (let i = 0; i < s.length; i++) view.setUint8(pos + i, s.charCodeAt(i)); };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);                 // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);                // 16-bit
  writeText(36, "data");
  view.setUint32(40, dataSize, true);

  let data = [];
  for (let c = 0; c < channels; c++) data.push(audioBuffer.getChannelData(c));
  let pos = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < channels; c++) {
      let sample = Math.max(-1, Math.min(1, data[c][i]));
      view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      pos += 2;
    }
  }
  return new Blob([view], { type: "audio/wav" });
}

// ---------- MIDI ----------

function exportMidi() {
  let ppq = 96;                       // ticks per quarter note in the MIDI file
  let ticksPerSixteenth = ppq / 4;
  let bpm = Tone.Transport.bpm.value;
  let tempo = Math.round(60000000 / bpm); // microseconds per quarter note

  let track = [];
  // tempo
  track.push(...varLen(0), 0xff, 0x51, 0x03, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255);

  let waiting = 0; // ticks of rest before the next note
  for (let token of playedTokens) {
    let [pitch, dur] = token.split(":");
    let ticks = parseInt(dur, 10) * ticksPerSixteenth;
    if (!pitch || isNaN(ticks)) continue;
    if (pitch === "ZZ") { waiting += ticks; continue; }
    let n = Tone.Frequency(pitch).toMidi();
    track.push(...varLen(waiting), 0x90, n, 80); // note on
    track.push(...varLen(ticks), 0x80, n, 0);    // note off
    waiting = 0;
  }
  track.push(...varLen(waiting), 0xff, 0x2f, 0x00); // end of track

  let header = [
    0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6,  // "MThd"
    0, 0,                                 // format 0 (one track)
    0, 1,                                 // 1 track
    (ppq >> 8) & 255, ppq & 255,
    0x4d, 0x54, 0x72, 0x6b,               // "MTrk"
    (track.length >> 24) & 255, (track.length >> 16) & 255, (track.length >> 8) & 255, track.length & 255
  ];
  downloadFile(new Blob([new Uint8Array(header.concat(track))], { type: "audio/midi" }), "markov-bass.mid");
}

// MIDI stores time gaps as "variable length" numbers
function varLen(value) {
  let bytes = [value & 0x7f];
  value >>= 7;
  while (value > 0) {
    bytes.unshift((value & 0x7f) | 0x80);
    value >>= 7;
  }
  return bytes;
}

// ---------- helper ----------

function downloadFile(blob, filename) {
  let a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
