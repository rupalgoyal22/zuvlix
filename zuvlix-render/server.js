const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── CLAUDE via raw fetch (no SDK needed) ──
async function claude(prompt, system, maxTokens) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set in Render environment');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens || 1200,
      system: system || 'You are an expert UGC ad creator and direct response copywriter.',
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.content.map(b => b.text || '').join('');
}

// ── CLAUDE with image (vision) ──
async function claudeVision(imageBase64, mediaType, textPrompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 } },
          { type: 'text', text: textPrompt }
        ]
      }]
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content.map(b => b.text || '').join('');
}

// ── JSON parser ──
function parseJSON(text) {
  const clean = text.replace(/```json\n?|```\n?/g, '').trim();
  const start = Math.min(
    clean.indexOf('[') === -1 ? Infinity : clean.indexOf('['),
    clean.indexOf('{') === -1 ? Infinity : clean.indexOf('{')
  );
  const end = Math.max(clean.lastIndexOf(']'), clean.lastIndexOf('}'));
  if (start === Infinity || end === -1) throw new Error('No JSON found');
  return JSON.parse(clean.slice(start, end + 1));
}

// ── MAIN API ──
app.post('/api/ai', async (req, res) => {
  const { action } = req.body;
  try {

    // SCRIPT
    if (action === 'script') {
      const { product, description, style, platform, tone, duration } = req.body;
      const styleMap = {
        testimonial: 'personal testimonial — speak as if you personally used and love this product',
        unboxing: 'unboxing — excited first impression opening for the first time',
        tutorial: 'tutorial — step-by-step how to get best results',
        lifestyle: 'lifestyle — aspirational, showing how it fits a beautiful life',
        problem: 'problem/solution — open with a pain point, reveal product as the answer'
      };
      const dur = parseInt(duration) || 30;
      const text = await claude(
        `Write a ${dur}-second ${styleMap[style] || styleMap.testimonial} UGC video script for ${platform || 'TikTok'}.\n\nProduct: ${product}\nDescription: ${description}\nTone: ${tone || 'casual'}\n\nRules:\n- Sound like a real human, not an ad\n- Scroll-stopping hook in first 3 seconds\n- Clear CTA at the end\n- No hashtags, no markdown, no asterisks\n\nFormat (plain labels only):\n[HOOK] opening line\n[MAIN] main content\n[CTA] call to action`,
        'Expert UGC copywriter. Natural human speech only.',
        900
      );
      return res.json({ script: text });
    }

    // HOOKS
    if (action === 'hooks') {
      const { product, description, count } = req.body;
      const n = Math.min(parseInt(count) || 20, 50);
      const text = await claude(
        `Generate exactly ${n} unique scroll-stopping UGC hooks for this product.\n\nProduct: ${product}\nDescription: ${description || 'great product'}\n\nRules:\n- Max 15 words each\n- Mix of: confession, question, bold claim, POV, number, controversy\n- Pure curiosity or shock\n\nReturn ONLY valid JSON array: ["hook1","hook2",...]`,
        'Hook writer. Return JSON array only, no other text.',
        Math.min(n * 55 + 200, 2500)
      );
      return res.json({ hooks: parseJSON(text) });
    }

    // VARIATIONS
    if (action === 'variations') {
      const { product, description, count, style, platform } = req.body;
      const n = Math.min(parseInt(count) || 5, 20);
      const text = await claude(
        `Generate ${n} different UGC ad variations for:\nProduct: ${product}\nDescription: ${description || ''}\nStyle: ${style}\nPlatform: ${platform}\n\nReturn ONLY valid JSON array:\n[{"title":"","angle":"","hook":"","emotion":"","cta":""},...]`,
        'Ad strategist. Return JSON only.',
        Math.min(n * 130 + 200, 3000)
      );
      return res.json({ variations: parseJSON(text) });
    }

    // CAPTIONS
    if (action === 'captions') {
      const { script, platform } = req.body;
      const text = await claude(
        `Create timed captions for this ${platform || 'TikTok'} video script.\n\nScript:\n${script}\n\nRules:\n- Max 6 words per caption\n- 2-3 seconds each\n\nReturn ONLY valid JSON:\n[{"text":"","start":0,"end":2.5},...]`,
        'Caption creator. Return JSON only.',
        900
      );
      return res.json({ captions: parseJSON(text) });
    }

    // SCORE
    if (action === 'score') {
      const { script, product, platform } = req.body;
      const text = await claude(
        `Analyse this UGC ad script critically.\n\nProduct: ${product || 'this product'}\nPlatform: ${platform || 'TikTok'}\nScript:\n${script}\n\nReturn ONLY valid JSON:\n{"overall":74,"hook_score":71,"retention_score":78,"clarity_score":80,"ctr_prediction":"2.8%","roas_prediction":"2.4x","strengths":["s1","s2","s3"],"improvements":["i1","i2","i3"],"best_audience":"","predicted_rank":"Top 25%"}`,
        'Performance marketer. Return JSON only.',
        900
      );
      return res.json({ score: parseJSON(text) });
    }

    // SCRAPE
    if (action === 'scrape') {
      const { url } = req.body;
      let pageText = 'URL: ' + url;
      try {
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Zuvlix/1.0)' },
          signal: AbortSignal.timeout(8000)
        });
        const html = await r.text();
        pageText = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .slice(0, 5000);
      } catch (e) { /* use URL only */ }
      const text = await claude(
        `Extract product info from this page. Return ONLY valid JSON:\n{"name":"","description":"","benefits":[],"audience":"","price":"","tone_suggestion":"casual"}\n\nPage content:\n${pageText}`,
        'Product researcher. Return JSON only.',
        600
      );
      return res.json({ result: parseJSON(text) });
    }

    // SHOPIFY INTEL
    if (action === 'shopify_intel') {
      const { url, product, description } = req.body;
      const text = await claude(
        `Generate deep ad intelligence for this product.\n\nURL: ${url || 'not provided'}\nProduct: ${product}\nDescription: ${description}\n\nReturn ONLY valid JSON:\n{"best_angles":[],"target_audiences":[],"pain_points":[],"emotional_triggers":[],"competitor_weaknesses":[],"best_platforms":[],"killer_hook_formula":""}`,
        'eCommerce strategist. Return JSON only.',
        1100
      );
      return res.json({ intel: parseJSON(text) });
    }

    // COMPETITOR INTEL
    if (action === 'competitor_intel') {
      const { competitor_url, product, description } = req.body;
      const text = await claude(
        `Analyse competitor strategy vs our product.\n\nOur product: ${product}\nOur description: ${description}\nCompetitor: ${competitor_url}\n\nReturn ONLY valid JSON:\n{"likely_competitor_angles":[],"gaps_we_can_exploit":[],"differentiation_hooks":[],"winning_angles_for_us":[],"ad_angles_to_avoid":[],"best_counter_strategy":""}`,
        'Competitive intelligence expert. Return JSON only.',
        1000
      );
      return res.json({ intel: parseJSON(text) });
    }

    // AVATAR BRIEF
    if (action === 'avatar_brief') {
      const { description, platform, style } = req.body;
      const text = await claude(
        `Create AI video avatar profile for: "${description}"\nPlatform: ${platform}\nStyle: ${style}\n\nReturn ONLY valid JSON:\n{"personality":"","voice_recommendation":"","why_it_works":"","heygen_prompt":"","did_prompt":"","tips":["","",""]}`,
        'AI avatar creator. Return JSON only.',
        900
      );
      return res.json({ brief: parseJSON(text) });
    }

    // AVATAR PORTRAIT
    if (action === 'avatar_portrait') {
      const seed = (req.body.description || 'custom').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'custom';
      return res.json({ portrait: { seed, avatar_url: `https://api.dicebear.com/9.x/personas/svg?seed=${seed}&backgroundColor=b6e3f4&radius=50` } });
    }

    // PERSONALISE SCRIPT
    if (action === 'personalise_script') {
      const { script, avatar_profile } = req.body;
      if (!script) return res.json({ script: '' });
      const ap = avatar_profile || {};
      const text = await claude(
        `Rewrite this UGC script in the voice of a specific avatar.\n\nAvatar description: ${ap.description || ''}\nPersonality: ${ap.personality || 'casual'}\nSpeaking style: ${ap.speaking_style || 'natural'}\nCatchphrase: ${ap.catchphrase || 'none'}\n\nOriginal script:\n${script}\n\nKeep the same structure and CTA. Adapt the language, tone, and personality. No markdown.`,
        'Script personalisation expert.',
        800
      );
      return res.json({ script: text });
    }

    // URL TO VIDEO
    if (action === 'url_to_video') {
      const { url } = req.body;
      let pageText = 'URL: ' + url;
      try {
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(8000)
        });
        const html = await r.text();
        pageText = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .slice(0, 4000);
      } catch (e) { /* use URL only */ }
      const text = await claude(
        `You scraped a product page. Generate a complete video brief.\n\nPage: ${pageText}\n\nReturn ONLY valid JSON:\n{"product":"","description":"","script":"[HOOK] ...\\n[MAIN] ...\\n[CTA] ...","hooks":["","",""],"recommended_voice":"Sarah","recommended_duration":"30"}`,
        'UGC video strategist. Return JSON only.',
        1200
      );
      return res.json({ brief: parseJSON(text) });
    }

    // IMAGE TO VIDEO
    if (action === 'image_to_video') {
      const { imageBase64, mediaType } = req.body;
      if (!imageBase64) return res.status(400).json({ error: 'No image provided' });
      const text = await claudeVision(
        imageBase64,
        mediaType || 'image/jpeg',
        'This is a product image. Identify what it is and generate a complete UGC video brief.\n\nReturn ONLY valid JSON:\n{"product":"","description":"","key_features":[],"script":"[HOOK] ...\\n[MAIN] ...\\n[CTA] ...","hooks":["","","","",""],"angle":"testimonial","tone":"casual"}'
      );
      return res.json({ brief: parseJSON(text) });
    }

    // TIMELINE SCENE
    if (action === 'timeline_scene') {
      const { scene_type, product, description, platform } = req.body;
      const sceneDesc = {
        hook: 'a scroll-stopping opening hook (0-3 seconds, 1 punchy sentence)',
        main: 'the main content showing benefits (3-25 seconds, 2-3 sentences)',
        cta: 'a clear call to action (last 5 seconds, 1 short sentence)'
      };
      const text = await claude(
        `Write ${sceneDesc[scene_type] || 'a scene'} for a ${platform || 'TikTok'} UGC video about "${product}" (${description}).\n\nWrite ONLY the scene text. No labels, no markdown. Conversational tone.`,
        'UGC script writer.',
        300
      );
      return res.json({ text: text.trim() });
    }

    // VOICE — ElevenLabs
    if (action === 'voice') {
      const key = process.env.ELEVENLABS_API_KEY;
      if (!key) return res.status(400).json({ error: 'ElevenLabs API key not set. Add ELEVENLABS_API_KEY in Render environment.' });
      const voice_id = req.body.voice_id || 'cgSgspJ2msm6clMCkdW9';
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': key },
        body: JSON.stringify({
          text: req.body.text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        })
      });
      if (!r.ok) {
        const err = await r.text();
        return res.status(400).json({ error: 'ElevenLabs error: ' + err.slice(0, 200) });
      }
      const buf = await r.arrayBuffer();
      return res.json({ audio: Buffer.from(buf).toString('base64') });
    }

    // AVATAR VIDEO — HeyGen
    if (action === 'avatar') {
      const key = process.env.HEYGEN_API_KEY;
      if (!key) return res.status(400).json({ error: 'HeyGen API key not set. Add HEYGEN_API_KEY in Render environment variables.' });
      const r = await fetch('https://api.heygen.com/v2/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': key },
        body: JSON.stringify({
          video_inputs: [{
            character: { type: 'avatar', avatar_id: req.body.avatar_id || 'Daisy-inskirt-20220818', scale: 1.0 },
            voice: { type: 'text', input_text: req.body.script, voice_id: 'en-US-JennyNeural' },
            background: { type: 'color', value: '#FAFAFA' }
          }],
          dimension: { width: 1080, height: 1920 }
        })
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
      return res.json({ video_id: d.data && d.data.video_id });
    }

    // AVATAR STATUS
    if (action === 'avatar_status') {
      const key = process.env.HEYGEN_API_KEY;
      if (!key) return res.status(400).json({ error: 'HeyGen not configured' });
      const r = await fetch('https://api.heygen.com/v1/video_status.get?video_id=' + req.body.video_id, {
        headers: { 'X-Api-Key': key }
      });
      const d = await r.json();
      return res.json({ status: d.data && d.data.status, video_url: d.data && d.data.video_url });
    }

    return res.status(400).json({ error: 'Unknown action: ' + action });

  } catch (err) {
    console.error('[API Error]', action, err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log('Zuvlix running on port ' + PORT));
