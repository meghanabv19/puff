// Talk to Puff. Types go to the main process, which calls the Claude API (the
// key lives there). If there's no API key, Puff still replies with cute little
// canned lines so the feature works for everyone — no key or subscription needed.

import { api, S, pick } from './runtime.js';
import { LINES } from './lines.js';
import { say } from './bubble.js';
import { react, activity, floaters, dance } from './pet.js';

// A few short jokes so "tell me a joke" always lands, even offline.
const JOKES = [
  'why did the cloud stay calm? it went with the flow ☁️',
  "what's a cloud's favorite snack? cotton candy! 🍬",
  'i tried to catch fog earlier… i mist 😆',
  'why was the little cloud so proud? it was on cloud nine ✨',
  "what do you call a nervous cloud? a little mist-ified 😅",
  'why did the computer go to therapy? too many bytes of stress 💻',
  'i told my desk a joke… it just stayed board 🪵',
];

// Say a line so it's visible whether or not the panel is open (panel: #chatReply,
// closed: the floating bubble).
function tell(line) {
  showReply(line);
  say(line, { ms: 5000, replace: true });
}

// Action commands: typing these makes Puff *do* something. Returns true if it
// handled the text so we skip the chat model.
function handleCommand(text) {
  const t = text.toLowerCase().replace(/[!?.,~]/g, '').trim();

  // specific dance styles
  let style = null;
  if (/\bballet\b/.test(t)) style = 'ballet';
  else if (/\bsalsa\b/.test(t)) style = 'salsa';
  else if (/\b(twirl|pirouette|spin)\b/.test(t)) style = 'twirl';
  else if (/\b(dance|boogie|party|dancing)\b/.test(t)) style = 'random';
  if (style) {
    const did = dance(style === 'random' ? undefined : style, 5600);
    const line = { ballet: 'ballet time~ 🩰', salsa: '¡salsa! 💃', twirl: 'wheee, spinning! 🌀' }[did] || pick(LINES.breakDance);
    tell(line);
    return true;
  }
  if (/\b(joke|funny|make me laugh)\b/.test(t)) {
    react('giggle'); tell(pick(JOKES));
    return true;
  }
  if (/\b(roll|barrel roll|tumble)\b/.test(t)) { react('roll'); return true; }
  if (/\b(coffee|tea|drink)\b/.test(t)) {
    activity('coffee', 6000); floaters(3, ['˚', '·', '~'], '#C9A27A');
    tell(pick(LINES.breakCoffee));
    return true;
  }
  if (/\b(nap|sleep|rest)\b/.test(t)) {
    activity('napping', 8000); tell(pick(LINES.breakNap));
    return true;
  }
  if (/\b(meditate|breathe|calm|relax)\b/.test(t)) {
    activity('meditating', 8000); tell(pick(LINES.breakMeditate));
    return true;
  }
  if (/\b(spin|celebrate|yay|hooray|woohoo)\b/.test(t)) { react('celebrate'); return true; }
  if (/\b(wink)\b/.test(t)) { react('wink'); return true; }
  if (/\b(jump|hop)\b/.test(t)) { react('jump'); return true; }
  if (/\b(hide|peekaboo|peek a boo)\b/.test(t)) { doPeekaboo(); return true; }
  return false;
}

// "puff!" / "hey puff" / just its name -> peekaboo
function isCallingName(text) {
  const name = 'puff';
  const t = text.toLowerCase().replace(/[!?.,~]/g, '').trim();
  return t === name || t === 'hey ' + name || t === 'hi ' + name || t === name + ' ' + name;
}

// The peekaboo sequence: duck off the edge (main moves the window), then pop
// back with a surprise. Shared by the chat box and the global hotkey.
export function doPeekaboo() {
  api.peekaboo();
  react('surprised');
  setTimeout(() => { react('giggle'); say(pick(LINES.peekaboo), { ms: 2600, replace: true }); }, 1150);
}

let inputEl, replyEl;
const history = []; // recent {role, content} turns for context

// Show Puff's reply in the panel (the floating bubble is hidden while the panel
// is open). Also mirror to the bubble for when chat is triggered another way.
function showReply(text, thinking = false) {
  if (!replyEl) return;
  replyEl.textContent = text;
  replyEl.classList.toggle('thinking', thinking);
  replyEl.classList.add('show');
  if (!thinking) {
    clearTimeout(showReply._t);
    showReply._t = setTimeout(() => replyEl.classList.remove('show'), 9000);
  }
}

function nameBit() {
  const n = (S.settings && S.settings.name ? S.settings.name : '').trim().toLowerCase();
  return n ? ' ' + n : '';
}

// Free, zero-setup fallback when there's no local/AI model. Not a real
// conversation, but warm and contextual so it still feels alive.
function offlineReply(text) {
  const t = text.toLowerCase();
  const n = nameBit();
  if (/\b(hi|hello|hey|yo|hiya|sup)\b/.test(t)) return pick(['hi' + n + '! ♡', 'hello hello~ 🌸', 'hehe hi' + n + '!']);
  if (/how are you|how r u|how you doin|whats up|what's up|wyd/.test(t)) return pick(["i'm cozy and happy you're here ♡", 'just floating around, watching you work ✨', 'great now that you said hi~']);
  if (/tired|sleepy|exhausted|burn(t|ed)? out|no energy/.test(t)) return pick(['rest is part of the work~ take a little break with me?', 'aw' + n + ', a quick nap or a stretch? ♡', "you've done enough for now, breathe 😴"]);
  if (/sad|down|cry|lonely|stressed|anxious|overwhelm|worried|upset/.test(t)) return pick(["i'm right here with you ♡", "one thing at a time" + n + ", we've got this", 'sending you the softest hug 🫂']);
  if (/thank/.test(t)) return pick(['anytime' + n + '! ✨', 'of course ♡', 'hehe ☺️']);
  if (/help|stuck|hard|difficult|cant|can't|struggl/.test(t)) return pick(["let's do one tiny step together?", 'break it into a small piece — you can do that bit ♡', "wanna start a 25-min focus? i'll sit with you"]);
  if (/focus|work|study|deadline|task|todo|to-do/.test(t)) return pick(['double-click me to start a focus session ✦', "let's get one thing done together~", 'i believe in you' + n + ' ♡']);
  if (/break|rest|pause/.test(t)) return pick(['yes! stretch, water, a little wiggle ♡', 'break time~ shall i dance? 🎵', 'good idea' + n + ', rest those eyes']);
  if (/water|thirsty|drink/.test(t)) return pick(['yes! sip sip 💧', 'hydration hero ♡']);
  if (/love|cute|adorable|sweet|precious/.test(t)) return pick(['♡ ♡ ♡', 'you\'re the cute one' + n + '! 🥰', 'hehe 🌸']);
  if (/hungry|food|eat|lunch|dinner|snack/.test(t)) return pick(['go nourish yourself' + n + ' ♡', 'snack break! i\'ll guard your desk 🍪']);
  if (/bye|goodnight|good night|night|see ya|cya/.test(t)) return pick(['byee' + n + ", i'll be right here ♡", 'rest well 🌙', 'sweet dreams~ 😴']);
  if (/who are you|what are you|your name/.test(t)) return pick(["i'm puff, your lil cloud buddy ☁️♡", 'just puff! here to keep you company ✨']);
  if (/\?$/.test(t.trim())) return pick(['hmm~ good question ♡', "i'm just a lil cloud, but i'm rooting for you!", 'tell me more' + n + '?']);
  return pick(['tell me more~', 'hehe ♡', "i'm listening" + n, 'boop!', '(=^･ω･^=)', 'mmhm ♡', "i'm here 🌸"]);
}

export function initChat() {
  inputEl = document.getElementById('chatInput');
  replyEl = document.getElementById('chatReply');
  if (!inputEl) return;

  inputEl.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';

    // calling Puff by name -> peekaboo!
    if (isCallingName(text)) { doPeekaboo(); return; }

    // action words ("dance", "tell me a joke", "roll"…) -> Puff does the thing
    if (handleCommand(text)) return;

    history.push({ role: 'user', content: text });
    showReply('puff is thinking…', true);
    react('giggle');

    let reply;
    try {
      const res = await api.chat(history);
      if (res && res.ok) reply = res.text;
      else if (res && res.error === 'no-key') reply = offlineReply(text); // graceful
      else reply = (res && res.text) || offlineReply(text);
    } catch {
      reply = offlineReply(text);
    }

    // resolve {name} + strip any stage-direction asterisks a local model might add
    reply = fillName(reply).replace(/\*[^*]*\*/g, '').replace(/\s{2,}/g, ' ').trim() || pick(LINES.idlePlay);

    history.push({ role: 'assistant', content: reply });
    if (history.length > 16) history.splice(0, history.length - 16);

    showReply(reply);
    say(reply, { ms: Math.min(9000, 2600 + reply.length * 40), replace: true }); // also for when panel closes
    react('love');
  });
}

// resolve a leading-space {name} style token if a canned line still has one
function fillName(s) {
  const n = (S.settings && S.settings.name ? S.settings.name : '').trim().toLowerCase();
  return s.replace(/\{name\}/g, n ? ' ' + n : '');
}
