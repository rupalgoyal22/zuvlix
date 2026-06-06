// Zuvlix Backend Server — Render.com
// Simple Express server that keeps all API keys secret

const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

// Serve your HTML files
app.use(express.static(path.join(__dirname, 'public')));

const CLAUDE  = process.env.ANTHROPIC_API_KEY;
const ELEVEN  = process.env.ELEVENLABS_API_KEY;
const HEYGEN  = process.env.HEYGEN_API_KEY;

// Helper to call Claude
async function claude(prompt, max = 800) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: max,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.content.map(c => c.text || '').join('');
}

function parseJSON(text) {
  const clean = text.replace(/```json|```/g, '').trim();
  const start = Math.min(
    clean.indexOf('[') === -1 ? Infinity : clean.indexOf('['),
    clean.indexOf('{') === -1 ? Infinity : clean.indexOf('{')
  );
  const end = Math.max(clean.lastIndexOf(']'), clean.lastIndexOf('}'));
  return JSON.parse(clean.slice(start, end + 1));
}

// Main API route
app.post('/api/ai', async (req, res) => {
  const { action } = req.body;

  try {

    if (action === 'scrape') {
      const { url } = req.body;
      let pageText = `URL: ${url}`;
      try {
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
        const html = await r.text();
        pageText = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 5000);
      } catch(e) {}
      const text = await claude(`Extract product info from this webpage. Return ONLY valid JSON: {"name":"","description":"","benefits":[],"audience":"","price":"","tone_suggestion":"casual"}\n\nWebpage: ${pageText}`, 600);
      return res.json({ result: parseJSON(text) });
    }

    if (action === 'script') {
      const { product, description, style, platform, tone, duration } = req.body;
      const styleMap = {
        testimonial: 'personal testimonial — speak as if you personally used and love this product',
        unboxing: 'unboxing video — excited reaction opening the product for the first time',
        tutorial: 'tutorial — step-by-step how to use for best results',
        lifestyle: 'lifestyle — aspirational, showing how it fits a beautiful life',
        problem: 'problem/solution — start with a pain point, reveal the product as the answer'
      };
      const words = Math.round((+duration || 30) * 2.5);
      const text = await claude(`Write a ${duration}-second ${styleMap[style] || styleMap.testimonial} UGC script for ${platform}.\n\nProduct: ${product}\nDescription: ${description}\nTone: ${tone || 'casual'}\n\nRequirements:\n- Completely authentic and human sounding\n- Natural speech, contractions, casual language\n- Scroll-stopping hook in first 3 seconds (~${words} words)\n- Clear CTA at end\n\nFormat (use plain text labels only, NO markdown, NO asterisks, NO dashes):\n[HOOK] - opening line\n[MAIN] - main content\n[CTA] - call to action\n\nNo hashtags. No markdown formatting. No asterisks. No --- separators.`, 700);
      return res.json({ script: text });
    }

    if (action === 'hooks') {
      const { product, description, count = 20 } = req.body;
      const text = await claude(`Generate ${count} scroll-stopping UGC hooks for this product.\n\nProduct: ${product}\nDescription: ${description}\n\nRules: Max 15 words each. Create curiosity, shock, or FOMO. Patterns: confession, question, bold claim, POV, number, controversy.\n\nReturn ONLY JSON array: ["hook 1","hook 2",...]`, Math.min(count * 60, 2000));
      return res.json({ hooks: parseJSON(text) });
    }

    if (action === 'variations') {
      const { product, description, count = 10, style, platform } = req.body;
      const text = await claude(`Generate ${count} different UGC ad variations.\n\nProduct: ${product}\nDescription: ${description}\nStyle: ${style || 'testimonial'}\nPlatform: ${platform || 'TikTok'}\n\nReturn ONLY JSON array: [{"title":"","hook":"","angle":"","emotion":"","cta":""}]`, Math.min(count * 120, 2500));
      return res.json({ variations: parseJSON(text) });
    }

    if (action === 'captions') {
      const { script, platform } = req.body;
      const text = await claude(`Convert this script into timed captions for ${platform || 'TikTok'}.\n\nScript: ${script}\n\nRules: Max 6 words per caption, ~2-3 seconds each.\n\nReturn ONLY JSON: [{"text":"","start":0,"end":2.5},...]`, 800);
      return res.json({ captions: parseJSON(text) });
    }

    if (action === 'score') {
      const { script, product, platform } = req.body;
      const text = await claude(`Analyse this UGC ad script critically.\n\nProduct: ${product}\nPlatform: ${platform || 'TikTok'}\nScript: ${script}\n\nReturn ONLY JSON:\n{"overall":74,"hook_score":71,"retention_score":78,"clarity_score":80,"emotional_score":69,"ctr_prediction":"2.8%","roas_prediction":"2.4x","strengths":["s1","s2","s3"],"improvements":["i1","i2","i3"],"winning_angle":"","best_audience":"","predicted_rank":"Top 25%","ab_test_suggestion":""}`, 700);
      return res.json({ score: parseJSON(text) });
    }

    if (action === 'shopify_intel') {
      const { url, product, description } = req.body;
      const text = await claude(`Analyse this product and give full intelligence.\n\nProduct: ${product}\nDescription: ${description}\nURL: ${url || 'not provided'}\n\nReturn ONLY JSON:\n{"best_angles":[],"target_audiences":[],"pain_points":[],"emotional_triggers":[],"competitor_weaknesses":[],"best_platforms":[],"content_formats":[],"seasonal_opportunities":[],"price_positioning":"","killer_hook_formula":""}`, 1000);
      return res.json({ intel: parseJSON(text) });
    }

    if (action === 'competitor_intel') {
      const { competitor_url, product, description } = req.body;
      const text = await claude(`Analyse competitor ad strategy.\n\nOur Product: ${product}\nOur Description: ${description}\nCompetitor: ${competitor_url}\n\nReturn ONLY JSON:\n{"likely_competitor_angles":[],"gaps_we_can_exploit":[],"differentiation_hooks":[],"winning_angles_for_us":[],"recommended_tone":"","best_counter_strategy":"","ad_angles_to_avoid":[]}`, 900);
      return res.json({ intel: parseJSON(text) });
    }

    if (action === 'voice') {
      if (!ELEVEN) return res.status(400).json({ error: 'ElevenLabs API key not configured. Add ELEVENLABS_API_KEY in Render environment variables.' });
      const { text, voice_id = 'EXAVITQu4vr4xnSDxMaL' } = req.body;
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': ELEVEN },
        body: JSON.stringify({ text, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.75 } })
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail?.message || 'ElevenLabs error'); }
      const buf = await r.arrayBuffer();
      const b64 = Buffer.from(buf).toString('base64');
      return res.json({ audio: b64, format: 'mp3' });
    }

    if (action === 'avatar') {
      if (!HEYGEN) return res.status(400).json({ error: 'HeyGen API key not configured. Add HEYGEN_API_KEY in Render environment variables.' });
      const { script, avatar_id = 'Daisy-inskirt-20220818', voice_id = '2d5b0e6cf36f460aa7fc47e3eee4ba54' } = req.body;
      const r = await fetch('https://api.heygen.com/v2/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': HEYGEN },
        body: JSON.stringify({
          video_inputs: [{ character: { type: 'avatar', avatar_id, scale: 1.0 }, voice: { type: 'text', input_text: script, voice_id }, background: { type: 'color', value: '#FAFAFA' } }],
          dimension: { width: 1080, height: 1920 }
        })
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error.message || 'HeyGen error');
      return res.json({ video_id: d.data.video_id, status: 'processing' });
    }

    if (action === 'avatar_status') {
      if (!HEYGEN) return res.status(400).json({ error: 'HeyGen not configured' });
      const { video_id } = req.body;
      const r = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${video_id}`, { headers: { 'X-Api-Key': HEYGEN } });
      const d = await r.json();
      return res.json({ status: d.data.status, video_url: d.data.video_url });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (e) {
    console.error('API Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// Serve app.html at /app
app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'public', 'app.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Zuvlix server running on port ${PORT}`));
