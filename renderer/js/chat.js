// Talk to Puff. Types go to the main process, which calls the Claude API (the
// key lives there). If there's no API key, Puff still replies with cute little
// canned lines so the feature works for everyone — no key or subscription needed.

import { api, S, pick } from './runtime.js';
import { say } from './bubble.js';
import { react } from './pet.js';

let inputEl;
const history = []; // recent {role, content} turns for context

function nameBit() {
  const n = (S.settings && S.settings.name ? S.settings.name : '').trim().toLowerCase();
  return n ? ' ' + n : '';
}

// keyword-ish fallback when there's no API key
function offlineReply(text) {
  const t = text.toLowerCase();
  if (/\b(hi|hello|hey|yo|hiya)\b/.test(t)) return 'hi' + nameBit() + '! ♡';
  if (/tired|sleepy|exhausted|burn/.test(t)) return 'rest is part of the work~ take a little break with me?';
  if (/sad|down|stressed|anxious|overwhelm/.test(t)) return "i'm right here with you ♡";
  if (/thank/.test(t)) return 'anytime{name}! ✨';
  if (/help|stuck|hard/.test(t)) return "let's do one tiny step together?";
  if (/focus|work|study/.test(t)) return 'double-click me to start a focus session ✦';
  if (/love|cute|adorable/.test(t)) return '♡ ♡ ♡';
  if (/bye|goodnight|night/.test(t)) return 'byee{name}, i\'ll be right here ♡';
  return pick(['tell me more~', 'hehe ♡', "i'm listening{name}", 'boop!', '(=^･ω･^=)']);
}

export function initChat() {
  inputEl = document.getElementById('chatInput');
  if (!inputEl) return;

  inputEl.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';

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
