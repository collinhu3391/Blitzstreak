// ═══════════════════════════════════════════════════════════════
//  tts.js  —  Blitzbeep Text-to-Speech Module
//  Works in both Single Player and Multiplayer modes.
//
//  REQUIRED globals from main file:
//    readSpeed      (number, words-per-minute)
//    ALL_PACKETS    (array)  — single player only
//    currentPacket  (number) — single player only
//    currentQuestion(number) — single player only
//
//  PUBLIC API (call these from anywhere):
//    speakQuestion()             — reads current SP question
//    speakText(text)             — reads any string (MP-friendly)
//    stopTTS()                   — cancels speech immediately
//    toggleTTS()                 — toggles TTS on/off (bound to #btnTTS)
//    onTTSQuestionLoad(text)     — call from loadQuestion() in both modes
// ═══════════════════════════════════════════════════════════════

'use strict';

// ── State ──────────────────────────────────────────────────────
let ttsEnabled  = false;
let ttsVoice    = null;
let _ttsPingTimer   = null;
let _ttsReady   = false;   // true once voices loaded at least once

// ── Voice preferences (best natural-sounding voices first) ────
const TTS_VOICE_PREFS = [
  'Google US English',
  'Google UK English Female',
  'Samantha',          // macOS / iOS
  'Karen',             // macOS
  'Daniel',            // macOS UK
  'Alex',              // macOS legacy
  'Microsoft Aria Online (Natural) - English (United States)',
  'Microsoft Jenny Online (Natural) - English (United States)',
  'Microsoft Zira Desktop - English (United States)',
  'Microsoft David Desktop - English (United States)',
];

// ── Voice Loader ───────────────────────────────────────────────
function loadVoices() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return;   // not ready yet — voiceschanged will retry

  for (const name of TTS_VOICE_PREFS) {
    const match = voices.find(v => v.name === name);
    if (match) { ttsVoice = match; _ttsReady = true; return; }
  }
  // Fallback: any English voice
  ttsVoice = voices.find(v => v.lang === 'en-US')
           || voices.find(v => v.lang.startsWith('en'))
           || voices[0]
           || null;
  _ttsReady = true;
}

// ── Chrome keep-alive ping ─────────────────────────────────────
// Chrome pauses speechSynthesis after ~15s when tab is backgrounded.
// Pause/resume every 10s keeps it alive.
function _startTTSPing() {
  _stopTTSPing();
  _ttsPingTimer = setInterval(() => {
    if (!ttsEnabled || !window.speechSynthesis) return;
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }
  }, 10000);
}
function _stopTTSPing() {
  if (_ttsPingTimer) { clearInterval(_ttsPingTimer); _ttsPingTimer = null; }
}

// ── Core speak ────────────────────────────────────────────────
// This is the single entry point for all speech. Both single
// player and multiplayer flow through here.
function speakText(text) {
  if (!ttsEnabled || !text) return;
  responsiveVoice.cancel();
  responsiveVoice.speak(text, "US English Female", {
    rate: Math.min(1.8, Math.max(0.5, (typeof readSpeed !== 'undefined' ? readSpeed : 160) / 160))
  });
function stopTTS() {
  if (typeof responsiveVoice !== 'undefined') responsiveVoice.cancel();
}
  const doSpeak = () => {
    const u = new SpeechSynthesisUtterance(text);

    // Re-query voices each call — Chrome can lose the stored reference
    const voices = window.speechSynthesis.getVoices();
    if (voices.length) {
      const picked = TTS_VOICE_PREFS
        .map(n => voices.find(v => v.name === n))
        .find(Boolean)
        || voices.find(v => v.lang === 'en-US')
        || voices.find(v => v.lang.startsWith('en'))
        || voices[0];
      if (picked) u.voice = picked;
    }

    u.lang   = 'en-US';
    u.rate   = Math.min(1.8, Math.max(0.5, (typeof readSpeed !== 'undefined' ? readSpeed : 160) / 160));
    u.pitch  = 1;
    u.volume = 1;

    u.onstart = () => _startTTSPing();
    u.onend   = () => _stopTTSPing();
    u.onerror = () => _stopTTSPing();

    // Chrome on Mac fix — cancel first, then speak after short delay
    window.speechSynthesis.cancel();
    setTimeout(() => window.speechSynthesis.speak(u), 100);
  };

  if (window.speechSynthesis.getVoices().length) {
    doSpeak();
  } else {
    // Voices not loaded yet — wait, then speak
    const handler = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
      doSpeak();
    };
    window.speechSynthesis.addEventListener('voiceschanged', handler);

    // Safety fallback: try after 300ms in case voiceschanged never fires
    setTimeout(() => {
      if (window.speechSynthesis.pending || window.speechSynthesis.speaking) return;
      doSpeak();
    }, 300);
  }
}

// ── Stop ──────────────────────────────────────────────────────
function stopTTS() {
  _stopTTSPing();
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

// ── Single-player helper ──────────────────────────────────────
// Reads the current SP question from ALL_PACKETS.
// Only call this in single-player context.
function speakQuestion() {
  if (
    typeof ALL_PACKETS    === 'undefined' ||
    typeof currentPacket  === 'undefined' ||
    typeof currentQuestion === 'undefined'
  ) {
    console.warn('[TTS] speakQuestion() called but SP globals not found.');
    return;
  }
  const q = ALL_PACKETS[currentPacket]?.questions[currentQuestion];
  if (q?.question) speakText(q.question);
}

// ── Universal question-load hook ──────────────────────────────
// Call this from loadQuestion() in BOTH single player and multiplayer.
// Pass the question text string directly so this file stays mode-agnostic.
//
//   Single player:   onTTSQuestionLoad(q.question)
//   Multiplayer:     onTTSQuestionLoad(receivedQuestion.text)
function onTTSQuestionLoad(text) {
  if (!ttsEnabled || !text) return;
  // Safari needs no delay, Chrome sometimes needs one
  const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
  if (isChrome) {
    setTimeout(() => speakText(text), 120);
  } else {
    speakText(text);
  }
}
// ── Toggle button ─────────────────────────────────────────────
// Bound to #btnTTS in the HTML. Updates button style on toggle.
function toggleTTS() {
  ttsEnabled = !ttsEnabled;
  const btn = document.getElementById('btnTTS');

  if (ttsEnabled) {
    // Force voice load on first user gesture (Chrome requires this)
    loadVoices();
    if (btn) {
      btn.textContent        = '🔊 TTS ON';
      btn.style.borderColor  = 'rgba(192,0,26,0.5)';
      btn.style.color        = 'var(--accent)';
    }
  } else {
    if (btn) {
      btn.textContent        = '🔇 TTS OFF';
      btn.style.borderColor  = '';
      btn.style.color        = '';
    }
    stopTTS();
  }
}

// ── Speed change hook ─────────────────────────────────────────
// If speech is currently active and the user adjusts the speed
// slider, this restarts speech at the new rate.
// Hook it up in main.js wherever readSpeed changes, e.g.:
//   document.getElementById('speedSlider').addEventListener('input', e => {
//     readSpeed = parseInt(e.target.value);
//     document.getElementById('speedVal').textContent = readSpeed + ' wpm';
//     onTTSSpeedChange();        // ← add this line
//   });
function onTTSSpeedChange() {
  if (!ttsEnabled || !window.speechSynthesis?.speaking) return;
  // Re-speak the current utterance at new speed is not possible mid-sentence,
  // so we cancel and the next question load will use the new rate.
  // If you want instant effect, call speakQuestion() / speakText() here instead.
  stopTTS();
}

// ── Init ──────────────────────────────────────────────────────
// Runs once when the script loads.
(function initTTS() {
  if (!window.speechSynthesis) {
    console.warn('[TTS] speechSynthesis not supported in this browser.');
    return;
  }
  // Chrome fires voiceschanged asynchronously; also try immediately for
  // Firefox / Safari which populate voices synchronously.
  window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
  loadVoices();
})();
