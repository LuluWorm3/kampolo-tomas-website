// Model providers for the chat function, tried in order until one answers.
// CHAT_PROVIDERS picks the order (default "claude"). A provider with no key is skipped, so adding Gemini or
// Ollama later means adding one entry to PROVIDERS and listing it here; chat.mjs does not change.
// Failover only happens before the first byte of an answer: a stream that breaks halfway cannot be swapped.

const TIMEOUT_MS = 25000;
const INTERRUPTED = '\n[The assistant was interrupted. Please try again.]';

// Turns Anthropic server-sent events into a plain text stream of the answer.
function claudeTextStream(upstream, onUsage) {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  return new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      let buf = '';
      const usage = { in: 0, out: 0 };
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line.startsWith('data:')) continue;
            let ev;
            try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
            if (ev.type === 'message_start' && ev.message && ev.message.usage) usage.in = ev.message.usage.input_tokens || 0;
            else if (ev.type === 'message_delta' && ev.usage) usage.out = ev.usage.output_tokens || usage.out;
            if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') controller.enqueue(enc.encode(ev.delta.text));
            else if (ev.type === 'error') controller.enqueue(enc.encode(INTERRUPTED));
          }
        }
      } catch {
        controller.enqueue(enc.encode(INTERRUPTED));
      }
      controller.close();
      if (onUsage) onUsage(usage);
    },
  });
}

// Each provider: configured(env) says whether it can run; run(...) returns { stream } or { reply }, or throws.
const PROVIDERS = {
  claude: {
    configured: (env) => Boolean(env.ANTHROPIC_API_KEY),
    models: (env) => (env.CLAUDE_MODELS || 'claude-haiku-5-5,claude-sonnet-5-5').split(',').map((m) => m.trim()).filter(Boolean),
    async run({ env, model, system, messages, maxTokens, wantStream, onUsage }) {
      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        // Haiku thinks by default and spends the small token cap, so the visible answer is cut short or empty.
        // Sonnet rejects "disabled" (400) and does not need it.
        body: JSON.stringify({ model, max_tokens: maxTokens, ...(/haiku/.test(model) ? { thinking: { type: 'disabled' } } : {}), system, messages, ...(wantStream ? { stream: true } : {}) }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!upstream.ok) throw new Error('HTTP ' + upstream.status);
      if (wantStream && upstream.body) return { stream: claudeTextStream(upstream, onUsage) };
      const data = await upstream.json();
      const reply = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
      if (onUsage && data.usage) onUsage({ in: data.usage.input_tokens || 0, out: data.usage.output_tokens || 0 });
      return { reply };
    },
  },
};

export function chain(env = process.env) {
  const wanted = (env.CHAT_PROVIDERS || 'claude').split(',').map((n) => n.trim().toLowerCase()).filter(Boolean);
  const steps = [];
  for (const name of wanted) {
    const p = PROVIDERS[name];
    if (!p || !p.configured(env)) continue;
    for (const model of p.models(env)) steps.push({ name, model, provider: p });
  }
  return steps;
}

// Tries every provider and model in order. Returns { stream } or { reply } from the first that answers.
// Returns null when nothing is configured, and { failed: true } when every step failed.
export async function generate(args, env = process.env) {
  const steps = chain(env);
  if (!steps.length) return null;
  let failovers = 0;
  for (const step of steps) {
    try {
      const result = await step.provider.run({ ...args, env, model: step.model });
      return { ...result, meta: { provider: step.name, model: step.model, failovers } };
    } catch (err) {
      failovers++;
      console.warn(JSON.stringify({ chat: 'provider_failed', provider: step.name, model: step.model, reason: String(err && err.message || err).slice(0, 80) }));
    }
  }
  return { failed: true, meta: { provider: '', model: '', failovers } };
}
