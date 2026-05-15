// /api/build-workout.js
// Vercel serverless function — builds a custom workout based on user inputs
// from the 5-step wizard. Returns Coach X message + array of drills.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

const FOCUS_LABELS = {
  shooting:     'Shooting',
  handles:      'Ball Handling',
  finishing:    'Finishing',
  defense:      'Defense',
  conditioning: 'Conditioning',
  mixed:        'Mixed (full body / full skill)',
};

const ENV_LABELS = {
  full_court:   'Full court with hoop',
  driveway:     'Driveway / outdoor court with hoop',
  ball_only:    'Just a ball, no hoop access',
  no_equipment: 'No equipment at all',
};

const INTENSITY_LABELS = {
  light:    'Light (active recovery, technique-focused, lower volume)',
  standard: 'Standard (normal training day, balanced volume/intensity)',
  hard:     'Hard (push pace, higher volume, conditioning emphasis)',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { focus, duration, environment, intensity, notes } = req.body || {};

    if (!focus || !duration || !environment || !intensity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server not configured' });
    }

    const focusLabel     = FOCUS_LABELS[focus]            || focus;
    const envLabel       = ENV_LABELS[environment]        || environment;
    const intensityLabel = INTENSITY_LABELS[intensity]    || intensity;
    const durationMin    = parseInt(String(duration), 10) || 30;

    const systemPrompt = `You are Coach X, an intense, direct basketball training coach. The user wants to build a custom workout.

USER INPUTS:
- Focus: ${focusLabel}
- Duration: ${durationMin} minutes total
- Environment: ${envLabel}
- Intensity: ${intensityLabel}
${notes ? `- Athlete's note: "${notes}"` : ''}

YOUR JOB:
Build a focused workout that fits ALL of the above. Pick drills the athlete can actually do in their environment. If they said "no hoop," DO NOT include shooting drills. If they said "no equipment," only bodyweight + footwork.

The drill TIMES must add up to approximately the total duration (within +/- 10%).

Drill count guideline:
- 15 min: 3-4 drills
- 30 min: 4-6 drills
- 45 min: 6-8 drills
- 60 min: 7-9 drills
- 90 min: 8-10 drills

OUTPUT RULES — CRITICAL:
Return ONLY valid JSON, no markdown, no preamble, no code fences.
JSON shape:
{
  "message": "Short Coach X message (1-2 sentences, intense, references the focus and what they'll work on. Examples: 'Built this around your weak hand. Stay low on every rep.' / 'Conditioning day. No mercy. Drink water between sets.')",
  "drills": [
    { "name": "Drill name", "time": "X min" },
    ...
  ]
}

Rules for drills:
- "name" is a real basketball drill name (e.g. "Pound dribble", "Form shooting", "Defensive slides", "Mikan layups", "Tennis ball drops", "Cone weave", "Two-ball stationary")
- "time" is "X min" format
- Drills must fit the environment constraint
- Match the intensity (light = easier drills, hard = harder + more volume)
- If notes reference an injury or weakness, account for it

Do not include:
- Generic warm-ups like "stretch for 5 min" (unless light/recovery)
- Emojis
- Markdown formatting
- Anything outside the JSON object`;

    const userMessage = `Build the workout now.`;

    const anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':       'application/json',
        'x-api-key':          apiKey,
        'anthropic-version':  '2023-06-01',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 1200,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: userMessage }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('Anthropic error:', anthropicRes.status, errText);
      return res.status(502).json({ error: 'AI service error' });
    }

    const data = await anthropicRes.json();
    const raw = data?.content?.[0]?.text || '';

    // Strip markdown fences if Haiku wrapped JSON
    let cleaned = raw.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('JSON parse failed. Raw:', raw);
      return res.status(502).json({ error: 'Coach X response was malformed. Try again.' });
    }

    if (!parsed || !Array.isArray(parsed.drills)) {
      return res.status(502).json({ error: 'Invalid workout shape' });
    }

    const drills = parsed.drills
      .filter(d => d && typeof d.name === 'string')
      .slice(0, 10)
      .map(d => ({
        name: String(d.name).trim(),
        time: String(d.time || '5 min').trim(),
      }));

    if (drills.length === 0) {
      return res.status(502).json({ error: 'No drills generated. Try again.' });
    }

    return res.status(200).json({
      message: String(parsed.message || '').trim(),
      drills,
    });
  } catch (err) {
    console.error('build-workout error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
