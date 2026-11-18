// ===== PLAYER UI (our addition, not part of the Mario Jazz tutorial) =====
// Shows how long the generation is (compared to the poem target)
// and adds a Pause / Play button.

const TARGET_SECONDS = 120; // poem length target: 2 minutes

let originalSeconds = 0;  // length of the source tokens
let generatedSeconds = 0; // length of the Markov part
let totalSeconds = 0;     // everything that plays (original + generated)
let pauseButton;
let finished = false;

// Called from sketch.js right after the music starts
function showPlayerUI() {
  originalSeconds = tokensToSeconds(sourceTokens); // length of the source material (not played)
  totalSeconds = tokensToSeconds(playedTokens);
  generatedSeconds = totalSeconds; // everything that plays is generated

  pauseButton = createButton("Pause").position(260, height + 20).mousePressed(togglePause);

  // Stop the clock when the music has finished (+1 s for the last note to fade)
  Tone.Transport.schedule(() => {
    Tone.Transport.stop();
    finished = true;
    pauseButton.html("Play again");
  }, totalSeconds + 1);
}

function togglePause() {
  if (Tone.Transport.state === "started") {
    Tone.Transport.pause();
    pauseButton.html("Play");
  } else {
    finished = false;
    Tone.Transport.start();
    pauseButton.html("Pause");
  }
}

// p5 calls this every frame: draws the info on the canvas
function draw() {
  background(220);
  fill(0);
  noStroke();

  if (!started) {
    textAlign(CENTER, CENTER);
    textSize(14);
    text("Click to generate and play", width / 2, height / 2);
    return;
  }
  if (totalSeconds === 0) {
    textAlign(CENTER, CENTER);
    text("Generating...", width / 2, height / 2);
    return;
  }

  // --- lengths ---
  textAlign(LEFT, TOP);
  textSize(13);
  text("Source material:  " + formatTime(originalSeconds) + "  (" + sourceTokens.length + " tokens)", 20, 16);
  text("Generated (Markov):  " + formatTime(generatedSeconds) + "  (" + playedTokens.length + " tokens)", 20, 36);
  text("Markov order:  " + MARKOV_ORDER, 20, 56);

  // --- compare with the 2-minute target ---
  let ok = generatedSeconds >= TARGET_SECONDS;
  fill(ok ? color(30, 130, 60) : color(190, 50, 40));
  text(
    ok
      ? "Generated part is long enough for the poem (target " + formatTime(TARGET_SECONDS) + ")"
      : "Generated part is too short: " + formatTime(TARGET_SECONDS - generatedSeconds) + " missing",
    20, 80
  );

  // --- progress bar ---
  let x = 20, y = 125, w = width - 40, h = 14;
  let pos = finished ? totalSeconds : min(Tone.Transport.seconds, totalSeconds);
  fill(255);
  rect(x, y, w, h);
  fill(70, 110, 200);
  rect(x, y, w * (pos / totalSeconds), h);

  fill(0);
  textSize(12);
  text(formatTime(pos) + " / " + formatTime(totalSeconds), x, y + h + 10);
  textAlign(RIGHT, TOP);
  text(Tone.Transport.state === "paused" ? "paused" : finished ? "finished" : "playing", x + w, y + h + 10);
}

// Length of a token list in seconds, at the current tempo
function tokensToSeconds(tokens) {
  let sixteenths = 0;
  for (let t of tokens) {
    let d = parseInt(t.split(":")[1], 10);
    if (!isNaN(d)) sixteenths += d;
  }
  return sixteenths * Tone.Time("16n").toSeconds();
}

function formatTime(seconds) {
  seconds = Math.max(0, Math.round(seconds));
  let m = Math.floor(seconds / 60);
  let s = seconds % 60;
  return m + ":" + (s < 10 ? "0" : "") + s;
}
