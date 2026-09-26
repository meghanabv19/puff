// Talk to Puff. Types go to the main process, which calls the Claude API (the
// key lives there). If there's no API key, Puff still replies with cute little
// canned lines so the feature works for everyone — no key or subscription needed.

import { api, S, pick } from './runtime.js';
import { LINES } from './lines.js';
import { say } from './bubble.js';
import { react } from './pet.js';

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

let inputEl;
const history = []; // recent {role, content} turns for context

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
  if (!inputEl) return;

  inputEl.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';

    // calling Puff by name -> peekaboo!
    if (isCallingName(text)) { doPeekaboo(); return; }

    history.push({ role: 'user', content: text });
    say('…', { ms: 12000, replace: true });
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

    history.push({ role: 'assistant', content: reply });
    if (history.length > 16) history.splice(0, history.length - 16);

    say(reply, { ms: Math.min(9000, 2600 + reply.length * 40), replace: true });
    react('love');
  });
}
