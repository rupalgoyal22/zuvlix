const express = require('express');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function claude(prompt, system, json) {
  const msg = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2000,
    system: system || 'You are an expert UGC ad creator and direct response copywriter.',
    messages: [{ role: 'user', content: prompt }]
  });
  const text = msg.content[0].text;
  if (json) {
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      const start = clean.indexOf('{');
      const end = clean.lastIndexOf('}');
      return JSON.parse(clean.slice(start, end + 1));
    } catch (e) {
      return { raw: text };
    }
  }
  return text;
}

app.post('/api/ai', async (req, res) => {
  try {
    const { action } = req.body;

    if (action === 'script') {
      const { product, description, style, platform, tone, duration, url } = req.body;
      const text = await claude(
        `Write a ${duration || 30}-second ${style || 'testimonial'} UGC video script for ${platform || 'TikTok'} for: "${product}"\n\nProduct: ${description}\n\nTone: ${tone || 'casual'}\n\nFormat:\n[HOOK] - Scroll-stopping opening (first 3 seconds)\n[MAIN] - Main content with benefits\n[CTA] - Clear call to action\n\nWrite naturally, conversationally. Sound like a real person, not an ad. Include specific details.`,
        'You are an expert UGC ad copywriter. Write scripts that sound authentic and human.'
      );
      return res.json({ script: text });
    }

    if (action === 'hooks') {
      const { product, description, count } = req.body;
      const n = Math.min(count || 20, 50);
      const data = await claude(
        `Generate ${n} unique scroll-stopping opening hooks for this product:\n\nProduct: ${product}\nDescription: ${description}\n\nInclude: confession hooks, question hooks, bold claim hooks, POV hooks, controversy hooks, before/after hooks, secret hooks, number hooks.\n\nReturn JSON: {"hooks": ["hook1","hook2",...]}`,
        'Expert UGC hook writer. JSON only.', true
      );
      return res.json({ hooks: data.hooks || [] });
    }

    if (action === 'variations') {
      const { product, description, count, style, platform } = req.body;
      const n = Math.min(count || 5, 20);
      const data = await claude(
        `Generate ${n} ad variations for: "${product}" - ${description}\nPlatform: ${platform}\nStyle: ${style}\n\nEach variation needs: title, angle, hook, cta.\nReturn JSON: {"variations":[{"title":"","angle":"","hook":"","cta":""},...]}`,
        'Expert ad strategist. JSON only.', true
      );
      return res.json({ variations: data.variations || [] });
    }

    if (action === 'captions') {
      const { script, platform } = req.body;
      const data = await claude(
        `Create timed captions for this ${platform} video script:\n\n${script}\n\nBreak into 3-6 word segments with timestamps. Return JSON: {"captions":[{"start":0,"end":3,"text":""},...]}`,
        'Caption generator. JSON only.', true
      );
      return res.json({ captions: data.captions || [] });
    }

    if (action === 'score') {
      const { script, product, platform } = req.body;
      const data = await claude(
        `Score this ${platform} UGC ad script for "${product}":\n\n${script}\n\nReturn JSON: {"overall":85,"hook_score":78,"retention_score":82,"ctr_prediction":"3.2%","roas_prediction":"2.8x","strengths":["..."],"improvements":["..."],"best_audience":"...","predicted_rank":"Top 20%"}`,
        'Expert performance marketer. JSON only.', true
      );
      return res.json({ score: data });
    }

    if (action === 'scrape') {
      const { url } = req.body;
      const data = await claude(
        `Pretend you scraped this product URL: ${url}\nGenerate realistic product data based on the URL.\nReturn JSON: {"name":"Product Name","description":"Brief description","benefits":["benefit1","benefit2","benefit3"],"price":"$XX","audience":"Target audience"}`,
        'Product researcher. JSON only.', true
      );
      return res.json({ result: data });
    }

    if (action === 'shopify_intel') {
      const { url, product, description } = req.body;
      const data = await claude(
        `Generate Shopify/eCommerce ad intelligence for:\nURL: ${url}\nProduct: ${product}\nDescription: ${description}\n\nReturn JSON: {"best_angles":["..."],"target_audiences":["..."],"pain_points":["..."],"emotional_triggers":["..."],"killer_hook_formula":"..."}`,
        'eCommerce strategist. JSON only.', true
      );
      return res.json({ intel: data });
    }

    if (action === 'competitor_intel') {
      const { competitor_url, product, description } = req.body;
      const data = await claude(
        `Generate competitor intelligence for brand "${competitor_url}" vs our product "${product}" - ${description}\n\nReturn JSON: {"likely_competitor_angles":["..."],"gaps_we_can_exploit":["..."],"differentiation_hooks":["..."],"ad_angles_to_avoid":["..."],"best_counter_strategy":"..."}`,
        'Competitive intelligence expert. JSON only.', true
      );
      return res.json({ intel: data });
    }

    if (action === 'avatar_brief') {
      const { description, platform, style } = req.body;
      const data = await claude(
        `Create an AI video avatar profile for: "${description}"\nPlatform: ${platform}, Style: ${style}\n\nReturn JSON: {"personality":"...","voice_recommendation":"...","why_it_works":"...","heygen_prompt":"...","did_prompt":"...","tips":["...","...","..."]}`,
        'AI avatar creator. JSON only.', true
      );
      return res.json({ brief: data });
    }

    if (action === 'avatar_portrait') {
      const { description } = req.body;
      return res.json({ portrait: { seed: description.slice(0, 10) } });
    }

    if (action === 'personalise_script') {
      const { script, avatar_profile } = req.body;
      const text = await claude(
        `Rewrite this script in the voice of this avatar:\nAvatar: ${JSON.stringify(avatar_profile)}\nScript: ${script}\n\nKeep the same message but adapt the language, phrasing, personality, and catchphrases to match this specific presenter.`,
        'Script personalisation expert.'
      );
      return res.json({ script: text });
    }

    if (action === 'url_to_video') {
      const { url } = req.body;
      const data = await claude(
        `A user pasted this product URL: ${url}\nGenerate a complete video brief as if you scraped it.\nReturn JSON: {"product":"Name","description":"...","benefits":["..."],"best_angle":"testimonial","script":"[HOOK]...\n[MAIN]...\n[CTA]...","hooks":["hook1","hook2","hook3"],"recommended_voice":"Sarah","recommended_duration":"30"}`,
        'UGC video strategist. JSON only.', true
      );
      return res.json({ brief: data });
    }

    if (action === 'image_to_video') {
      const { imageBase64, mediaType } = req.body;
      const msg = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: 'This is a product image. Describe the product and generate a complete UGC video brief. Return JSON: {"product":"Name","description":"...","key_features":["..."],"script":"[HOOK]...\n[MAIN]...\n[CTA]...","hooks":["hook1","hook2","hook3","hook4","hook5"],"angle":"testimonial","tone":"casual"}' }
          ]
        }]
      });
      try {
        const text = msg.content[0].text;
        const clean = text.replace(/```json|```/g, '').trim();
        const start = clean.indexOf('{');
        const end = clean.lastIndexOf('}');
        return res.json({ brief: JSON.parse(clean.slice(start, end + 1)) });
      } catch (e) {
        return res.json({ brief: { product: 'Product', description: 'AI-identified product', script: msg.content[0].text } });
      }
    }

    if (action === 'voice') {
      const { text, voice_id } = req.body;
      if (!process.env.ELEVENLABS_API_KEY) return res.json({ error: 'ElevenLabs key not set' });
      const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
        method: 'POST',
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.75 } })
      });
      if (!resp.ok) {
        const err = await resp.text();
        return res.json({ error: 'ElevenLabs: ' + err.slice(0, 100) });
      }
      const buf = await resp.arrayBuffer();
      return res.json({ audio: Buffer.from(buf).toString('base64') });
    }

    if (action === 'avatar') {
      const { script, avatar_id } = req.body;
      if (!process.env.HEYGEN_API_KEY) return res.json({ error: 'HeyGen key not configured' });
      const resp = await fetch('https://api.heygen.com/v2/video/generate', {
        method: 'POST',
        headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_inputs: [{ character: { type: 'avatar', avatar_id, scale: 1 }, voice: { type: 'text', input_text: script, voice_id: 'en-US-JennyNeural' }, background: { type: 'color', value: '#FAFAFA' } }], dimension: { width: 1080, height: 1920 } })
      });
      const d = await resp.json();
      return res.json({ video_id: d.data && d.data.video_id });
    }

    if (action === 'avatar_status') {
      const { video_id } = req.body;
      if (!process.env.HEYGEN_API_KEY) return res.json({ status: 'no_key' });
      const resp = await fetch('https://api.heygen.com/v1/video_status.get?video_id=' + video_id, {
        headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY }
      });
      const d = await resp.json();
      return res.json({ status: d.data && d.data.status, video_url: d.data && d.data.video_url });
    }

    if (action === 'timeline_scene') {
      const { scene_type, product, description, platform } = req.body;
      const text = await claude(
        `Write a ${scene_type} scene for a ${platform} UGC video about "${product}" (${description}).\n\nScene type: ${scene_type === 'hook' ? 'Scroll-stopping opening (0-3 seconds)' : scene_type === 'main' ? 'Main content showing benefits (3-25 seconds)' : 'Call to action (last 5 seconds)'}\n\nWrite 1-3 sentences only, conversational tone.`,
        'UGC script writer. Write only the scene text, no labels.'
      );
      return res.json({ text });
    }

    return res.status(400).json({ error: 'Unknown action: ' + action });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log('Zuvlix running on port ' + PORT));
