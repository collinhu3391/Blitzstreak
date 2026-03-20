// ═══════════════════════════════════════════════════════════════
//  tts.js  —  Blitzbeep Text-to-Speech Module
//  Powered by ResponsiveVoice (cross-browser, no API key needed)
//
//  REQUIRED: Add this script tag BEFORE tts.js in your HTML:
//  <script src="https://code.responsivevoice.org/responsivevoice.js?key=FREE"></script>
//
//  REQUIRED globals from main file:
//    readSpeed       (number, words-per-minute)
//    ALL_PACKETS     (array)  — single player
//    currentPacket   (number) — single player
//    currentQuestion (number) — single player
//
//  PUBLIC API:
//    speakText(text)         — reads any string (works in SP and MP)
//    stopTTS()               — cancels speech immediately
//    toggleTTS()             — toggles TTS on/off (bound to #btnTTS)
//    onTTSQuestionLoad(text) — call from loadQuestion() in both modes
//    onTTSSpeedChange()      — call when speed slider changes
// ═══════════════════════════════════════════════════════════════

'use strict';

// ── State ──────────────────────────────────────────────────────
let ttsEnabled = false;

// ── Core speak ────────────────────────────────────────────────
function speakText(text) {
  if (!ttsEnabled || !text) return;
  if (typeof responsiveVoice === 'undefined') {
    console.warn('[TTS] ResponsiveVoice not loaded.');
    return;
  }
  responsiveVoice.cancel();
  responsiveVoice.speak(text, 'US English Female', {
    rate: Math.min(1.8, Math.max(0.5, (typeof readSpeed !== 'undefined' ? readSpeed : 160) / 160)),
    pitch: 1,
    volume: 1
  });
}

// ── Stop ──────────────────────────────────────────────────────
function stopTTS() {
  if (typeof responsiveVoice !== 'undefined') responsiveVoice.cancel();
}

// ── Toggle button ─────────────────────────────────────────────
function toggleTTS() {
  ttsEnabled = !ttsEnabled;
  const btn = document.getElementById('btnTTS');

  if (ttsEnabled) {
    if (btn) {
      btn.textContent       = '🔊 TTS ON';
      btn.style.borderColor = 'rgba(192,0,26,0.5)';
      btn.style.color       = 'var(--accent)';
    }
    // Speak current question immediately on enable
    if (typeof ALL_PACKETS !== 'undefined') {
      speakText(ALL_PACKETS[currentPacket].questions[currentQuestion].question);
    }
  } else {
    if (btn) {
      btn.textContent       = '🔇 TTS OFF';
      btn.style.borderColor = '';
      btn.style.color       = '';
    }
    stopTTS();
  }
}

// ── Universal question-load hook ──────────────────────────────
// Call from loadQuestion() in BOTH single player and multiplayer.
// Pass the question text string directly.
//
//   Single player:  onTTSQuestionLoad(q.question)
//   Multiplayer:    onTTSQuestionLoad(receivedQuestion.text)
function onTTSQuestionLoad(text) {
  if (!ttsEnabled || !text) return;
  speakText(text);
}

// ── Speed change hook ─────────────────────────────────────────
// Call this when the speed slider changes.
// Cancels current speech — next question will use the new rate.
function onTTSSpeedChange() {
  if (!ttsEnabled) return;
  stopTTS();
}
