// Serverless function: forwards the app's requests to the Claude API.
// The API key stays on the server (environment variable ANTHROPIC_API_KEY).
const MAX_PROMPT = 30000;      // characters
const MAX_IMAGES = 5;
const MAX_IMAGE_B64 = 3_000_000; // ~2.2 MB per image after base64
const PER_MINUTE = 20;          // best-effort limit per IP

const SYSTEM =
  'You help Korean travellers prepare lists of food and medicine to declare at Australian biosecurity and customs. ' +
  'Be accurate about Korean products. When the user asks for JSON, reply with JSON only, no extra text.';

const hits = new Map();

export default async function handler(req, res) {
  // GET = status check used by the app at start-up (no Claude call, no cost)
  if (req.method === 'GET') return res.status(200).json({ ready: !!process.env.ANTHROPIC_API_KEY, passcode: !!process.env.APP_PASSCODE });
  if (req.method !== 'POST') return res.status(405).json({ code: 'method', error: 'GET or POST only' });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ code: 'no_key', error: 'ANTHROPIC_API_KEY is not set on the server' });

  const pass = process.env.APP_PASSCODE;
  if (pass && req.headers['x-app-passcode'] !== pass) return res.status(401).json({ code: 'passcode', error: 'passcode required' });

  const ip = String(req.headers['x-forwarded-for'] || 'local').split(',')[0].trim();
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= PER_MINUTE) return res.status(429).json({ code: 'rate_limited', error: 'too many requests' });
  recent.push(now);
  hits.set(ip, recent);

  const { prompt, images = [], tier } = req.body || {};
  if (typeof prompt !== 'string' || !prompt.trim()) return res.status(400).json({ code: 'invalid_request', error: 'prompt missing' });
  if (prompt.length > MAX_PROMPT) return res.status(413).json({ code: 'prompt_too_large', error: 'prompt too long' });
  if (!Array.isArray(images) || images.length > MAX_IMAGES) return res.status(400).json({ code: 'image_rejected', error: 'too many images' });
  for (const im of images) {
    if (!im || !/^image\/(jpeg|png|webp|gif)$/.test(im.media_type) || typeof im.data !== 'string' || im.data.length > MAX_IMAGE_B64)
      return res.status(400).json({ code: 'image_rejected', error: 'bad image' });
  }

  const model = tier === 'quick'
    ? process.env.CLAUDE_MODEL_QUICK || 'claude-haiku-4-5-20251001'
    : process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';

  const content = [
    ...images.map((im) => ({ type: 'image', source: { type: 'base64', media_type: im.media_type, data: im.data } })),
    { type: 'text', text: prompt },
  ];

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 4096, system: SYSTEM, messages: [{ role: 'user', content }] }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const code = r.status === 429 ? 'rate_limited' : r.status === 401 ? 'no_key' : 'upstream_error';
      return res.status(r.status === 429 ? 429 : 502).json({ code, error: j?.error?.message || `Claude API ${r.status}` });
    }
    const text = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    return res.status(200).json({ text, truncated: j.stop_reason === 'max_tokens', model });
  } catch (e) {
    return res.status(502).json({ code: 'upstream_error', error: String(e) });
  }
}
