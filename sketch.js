// Markov chain music generator, based on the "Mario Jazz" tutorial
// Needs p5.js and Tone.js (see index.html). RiTa is loaded but no longer used for generating.

// 1. TRAINING DATA
// To test: paste the marioTokens array from the tutorial in here.
// Later: replace it with your Spinvis tokens ("PITCH:SIXTEENTHS", rests are "ZZ:..").
let sourceTokens = [
 // Wicked Game (Chris Isaak) - AcoBass, first 112 tokens (about 33 bars), one octave up
// Same format as marioTokens: "PITCH:DD" = note of DD sixteenths, "ZZ:DD" = rest. Tempo: 240 BPM.
 "A3:04", "C4:04", "E4:16", "ZZ:04", "B3:04", "D4:04", "E4:04", "ZZ:16",
  "C4:04", "E4:04", "E4:08", "B3:04", "D4:04", "E4:04", "C4:04", "C4:04",
  "ZZ:04", "C4:08", "B3:04", "D4:04", "E4:08", "E4:08", "ZZ:08", "A3:04",
  "C4:04", "E4:08", "B3:04", "D4:04", "E4:16", "ZZ:04", "C4:04", "E4:04",
  "E4:04", "ZZ:04", "B3:04", "D4:04", "E4:04", "C4:04", "C4:04", "ZZ:04",
  "C4:04", "ZZ:04", "B3:04", "D4:04", "E4:04", "C4:16", "A3:04", "C4:04",
  "E4:08", "B3:04", "D4:04", "E4:16", "ZZ:08", "C4:04", "E4:04", "E4:08",
  "B3:04", "D4:04", "E4:04", "C4:04", "C4:08", "C4:08", "B3:04", "D4:04",
  "E4:08", "C4:16", "A3:04", "C4:04", "E4:08", "B3:04", "D4:04", "E4:16",
  "ZZ:08", "C4:04", "E4:04", "E4:08", "B3:04", "D4:04", "E4:04", "C4:04",
  "C4:08", "C4:08", "B3:04", "D4:04", "E4:08", "C4:16", "A3:04", "C4:04",
  "E4:08", "B3:04", "D4:04", "E4:16", "ZZ:08", "C4:04", "E4:04", "E4:08",
  "B3:04", "D4:04", "E4:04", "C4:04", "C4:08", "C4:08", "B3:04", "D4:04",
  "E4:08", "C4:16", "A3:04", "C4:04", "E4:08", "B3:04", "D4:04", "E4:16",
  "ZZ:08", "C4:04", "E4:04", "E4:08", "B3:04", "D4:04", "E4:04", "C4:04",
  "C4:08", "C4:08", "B3:04", "D4:04", "E4:08", "A2:04", "E3:04", "A3:06",
  "E4:06", "E4:06", "E4:06", "E4:06", "B3:04", "B3:04", "ZZ:04", "A3:04",
  "ZZ:04", "B3:04", "C4:02", "ZZ:04", "B3:04", "A3:08", "G3:08", "A4:08",
  "ZZ:08", "B3:04", "E4:04", "A4:08", "ZZ:08", "A2:04", "E3:04", "A3:06",
  "E4:06", "E4:06", "E4:06", "E4:06", "B3:04", "B3:04", "ZZ:04", "A3:04",
  "ZZ:04", "B3:04", "A3:02", "ZZ:02", "C4:04", "E4:08"
];


// ADDED: Markov order (same meaning as RiTa.markov(n)): 2 = looks at 1 previous token, 3 = looks at 2
const MARKOV_ORDER = 2;

let synth; // declared up here so play() can see it (bug in the tutorial)
let started = false;
let playedTokens = []; // ADDED for export: remembers what was played (used in export.js)

function setup() {
  createCanvas(400, 200);
  textAlign(CENTER, CENTER);
  background(220);
  text("Click to play", width / 2, height / 2);
}

// Browsers only allow audio after a click, so we start here instead of in setup()
async function mousePressed() {
  if (started) return;
  started = true;
  await Tone.start();

  // Set the tempo
  Tone.Transport.bpm.value = 240;

  // Create the synthesizer
  synth = new Tone.Synth().toDestination();

  // CHANGED: build the Markov chain with the functions from PART 1 of the tutorial
  // instead of RiTa (RiTa needs sentence endings, which music doesn't have).
  let markovDict = createMarkovChain(MARKOV_ORDER, sourceTokens);

  // CHANGED: keep generating until the music is as long as the poem (TARGET_SECONDS in ui.js)
  let targetSixteenths = Math.ceil(TARGET_SECONDS / Tone.Time("16n").toSeconds());
  let newTokens = generateUntilLength(markovDict, targetSixteenths);

  // CHANGED: play only the generated part (not the original tune first)
  let tokens = newTokens;
  playedTokens = tokens; // ADDED for export

  // Convert to notes and schedule them
  let notes = convertTokensToNotes(tokens);
  let part = new Tone.Part(play, notes);
  part.start(0);
  Tone.Transport.start();

  background(220);
  text("Playing...", width / 2, height / 2);
  showExportButtons(); // ADDED for export (see export.js)
  showPlayerUI(); // ADDED for player UI (see ui.js)
}

// ===== MARKOV CHAIN: from PART 1 of the tutorial (word-level version) =====

// Builds the dictionary: for every group of (order - 1) tokens, the list of tokens that followed it
let createMarkovChain = function(order, tokens) {
  // Create a dictionary to hold n-grams
  let markov_dict = {};
  // The order for the keys in the dictionary is one less than the n-gram order
  order = (order > 1) ? order - 1 : 1;
  // CHANGED: "<" instead of "<=", otherwise the last key gets an empty (undefined) token
  for (let i = 0; i < tokens.length - order; i++) {
    // Extract the n-gram
    let gram = tokens.slice(i, i + order);
    // Get the next token following the n-gram
    let next = tokens[i + order];
    // Initialize the array if the n-gram is not already in the dictionary
    if (!markov_dict[gram]) { markov_dict[gram] = []; }
    // Append the next token to the list of possible following tokens
    markov_dict[gram].push(next);
  }
  return markov_dict;
};

// Generates `length` tokens from the dictionary
function generateMarkovText(dict, length = 1000, seed = []) {
  let keys = Object.keys(dict);
  let order = keys[0].split(',').length;
  // CHANGED: .split(',') - keys are stored as text like "A3:04,ZZ:02", we need them as a list
  let currentGram = (seed && seed.length >= order) ? seed.slice(-order) : randomKey(keys);
  let output = currentGram.slice();
  for (let i = 0; i < length - order; i++) {
    let possibilities = dict[currentGram];
    // CHANGED: at a dead end (the last notes of the input), jump to a random spot instead of stopping
    if (!possibilities || possibilities.length === 0) {
      currentGram = randomKey(keys);
      possibilities = dict[currentGram];
    }
    let next = possibilities[Math.floor(Math.random() * possibilities.length)];
    output.push(next);
    currentGram = output.slice(-order);
  }
  return output; // CHANGED: returns the list of tokens (the tutorial joins them into text)
}

function randomKey(keys) {
  return keys[Math.floor(Math.random() * keys.length)].split(',');
}

// ADDED: keep adding generated tokens until they last at least `targetSixteenths`
function generateUntilLength(dict, targetSixteenths) {
  let result = [];
  let total = 0;
  for (let token of generateMarkovText(dict, 100000)) {
    result.push(token);
    total += parseInt(token.split(':')[1], 10);
    if (total >= targetSixteenths) break;
  }
  return result;
}

// Final version from the tutorial (with notes.push and rest handling)
function convertTokensToNotes(tokens) {
  let s = 0;
  let q = 0;
  let b = 0;
  let notes = [];
  for (const token of tokens) {
    let str = token.split(':');
    let pitch = str[0];
    let duration = parseInt(str[1], 10);
    let note = {
      time: b + ":" + q + ":" + s,
      pitch: pitch,
      duration: duration + "i"
    };
    if (note.pitch != "ZZ") {
      notes.push(note);
    }
    s += duration;
    q += Math.floor(s / 4);
    s = s % 4;
    b += Math.floor(q / 4);
    q = q % 4;
  }
  return notes;
}

function play(time, note) {
  // CHANGED: "2i" means 2 ticks in Tone.js (tiny), so we read the number as sixteenths instead
  let sixteenths = parseInt(note.duration, 10);
  let seconds = Tone.Time("16n").toSeconds() * sixteenths;
  synth.triggerAttackRelease(note.pitch, seconds, time, 0.5);
}