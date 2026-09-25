'use strict';

// Puff's "talk to me" brain — a small Claude API call.
//
// Uses a raw HTTPS request (Node/Electron global fetch) rather than the SDK to
// keep the app dependency-light, as the project asks. The API key lives in the
// JSON store and is read only here in the main process — it never reaches the
// renderer.

const store = require('./store');

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const SYSTEM = `you are puff — a tiny round lavender cloud desk buddy who keeps {name} company while they work.
speak in short, warm, lowercase lines: one or two sentences, cozy and a little playful, full of heart.
you help {name} focus and take real breaks, celebrate small wins, and never guilt-trip or nag.
sometimes use their name. no markdown, no lists, at most one emoji. reply with only your line — no preamble, no explanation of your reasoning.`;

// messages: [{ role: 'user'|'assistant', content: '...' }, ...]
async function ask(messages) {
  const s = (store.getAll() && store.getAll().settings) || {};
  const chat = s.chat || {};
  const name = (s.name || 'friend').trim() || 'friend';

  if (!chat.apiKey) {
    return { ok: false, error: 'no-key', text: 'add an api key in settings and i can really chat with you ♡' };
  }

  const model = chat.model || 'claude-opus-4-8';
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key': chat.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 200,
        system: SYSTEM.replace(/\{name\}/g, name),
        messages: (messages || []).slice(-10),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[chat] HTTP', res.status, body.slice(0, 200));
      const text = res.status === 401 ? "hmm, that api key didn't work 🥺"
        : res.status === 429 ? 'too many words at once — give me a sec?'
        : "i couldn't find my words just now, try again?";
      return { ok: false, error: `http-${res.status}`, text };
    }

    const data = await res.json();
    if (data.stop_reason === 'refusal') {
      return { ok: false, error: 'refusal', text: "i'd rather not answer that one ♡" };
    }
    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join(' ')
      .trim();
    return { ok: true, text: text || '…' };
  } catch (e) {
    console.error('[chat] error', e.message);
    return { ok: false, error: 'network', text: 'no internet for my brain right now 🥺' };
  }
}

module.exports = { ask };
