'use strict';

// Puff's "talk to me" brain. Three ways to run it, in this priority:
//
//   1. LOCAL model via Ollama (http://localhost:11434) — FREE, private, offline.
//      This is the default. Install Ollama + a small model and Puff just talks.
//   2. Anthropic API — only if you deliberately add a key (pay-as-you-go).
//   3. Built-in canned replies — always available, zero setup, zero cost.
//
// Nothing here costs money unless you explicitly choose provider 'anthropic'
// and supply a key. Titles/keys never leave the main process.

const store = require('./store');

const OLLAMA = 'http://localhost:11434';
const ANTHROPIC = 'https://api.anthropic.com/v1/messages';

const PERSONA = `you are puff — a tiny round lavender cloud desk buddy who keeps {name} company while they work.
speak in short, warm, lowercase lines: one or two sentences, cozy and a little playful, full of heart.
you help {name} focus and take real breaks, celebrate small wins, and never guilt-trip or nag.
sometimes use their name. no markdown, no lists, at most one emoji. reply with ONLY your line.`;

function persona(name) { return PERSONA.replace(/\{name\}/g, name); }

async function ollamaUp() {
  try {
    const r = await fetch(OLLAMA + '/api/tags', { method: 'GET' });
    if (!r.ok) return null;
    const d = await r.json();
    return (d.models || []).map((m) => m.name);
  } catch { return null; }
}

async function askOllama(messages, name, model) {
  const res = await fetch(OLLAMA + '/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      options: { temperature: 0.8, num_predict: 120 },
      messages: [{ role: 'system', content: persona(name) }, ...messages.slice(-8)],
    }),
  });
  if (!res.ok) throw new Error('ollama ' + res.status);
  const data = await res.json();
  return (data.message && data.message.content || '').trim();
}

async function askAnthropic(messages, name, chat) {
  const res = await fetch(ANTHROPIC, {
    method: 'POST',
    headers: {
      'x-api-key': chat.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: chat.model || 'claude-opus-4-8',
      max_tokens: 200,
      system: persona(name),
      messages: messages.slice(-10),
    }),
  });
  if (!res.ok) throw new Error('anthropic ' + res.status);
  const data = await res.json();
  if (data.stop_reason === 'refusal') return "i'd rather not answer that one ♡";
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim();
}

// messages: [{ role: 'user'|'assistant', content }]
async function ask(messages) {
  const s = (store.getAll() && store.getAll().settings) || {};
  const chat = s.chat || {};
  const name = (s.name || 'friend').trim() || 'friend';
  const provider = chat.provider || 'auto'; // auto | ollama | anthropic | canned

  // 1) local model (free) — used in 'auto' and 'ollama'
  if (provider === 'auto' || provider === 'ollama') {
    const models = await ollamaUp();
    if (models && models.length) {
      const want = chat.ollamaModel && models.includes(chat.ollamaModel) ? chat.ollamaModel : models[0];
      try {
        const text = await askOllama(messages, name, want);
        if (text) return { ok: true, via: 'ollama', text };
      } catch (e) { console.error('[chat] ollama:', e.message); }
    } else if (provider === 'ollama') {
      return { ok: false, error: 'no-ollama', text: 'start ollama and i can really chat ♡ (see settings)' };
    }
  }

  // 2) Anthropic (only if explicitly configured with a key)
  if ((provider === 'auto' || provider === 'anthropic') && chat.apiKey) {
    try {
      const text = await askAnthropic(messages, name, chat);
      if (text) return { ok: true, via: 'anthropic', text };
    } catch (e) {
      console.error('[chat] anthropic:', e.message);
      if (provider === 'anthropic') return { ok: false, error: 'anthropic', text: "hmm, my brain hiccuped — try again?" };
    }
  }

  // 3) canned (free, always works) — signal the renderer to use its cute fallback
  return { ok: false, error: 'no-key', text: '' };
}

module.exports = { ask, ollamaUp };
