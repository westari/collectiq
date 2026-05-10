// /api/coach-x-edit.js
// Vercel serverless function — edits a workout based on a user request via Claude Haiku

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

// Optional: load your drill library here so Coach X can only pick real drills.
// For now we let Coach X propose freeform drill names; you can swap to library-matched IDs later.

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { currentWorkout, dayContext, userRequest, recentMessages } = req.body || {};

    if (!currentWorkout || !userRequest) {
      return res.status(400).json({ error: 'Missing currentWorkout or userRequest' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server not configured' });
    }

    const systemPrompt = `You are Coach X, an intense and direct basketball training coach. The user wants to edit their current workout.

CURRENT WORKOUT:
Focus: ${currentWorkout.focus}
Duration: ${currentWorkout.duration}
Drills:
${(currentWorkout.drills || []).map((d, i) => `${i + 1}. ${d.name} (${d.time})`).join('\n')}

DAY CONTEXT:
Day ${(dayContext?.dayIndex ?? 0) + 1} of ${dayContext?.totalDays ?? 7}

Your job: based on the user's request, rebuild the drill list. Keep it focused, hard, and realistic to do with just a phone and a ball (unless the user has gym/court access). If they say "no hoop today", swap shooting drills for ball-handling/conditioning. If they say "shorter", trim total time. If they say "harder", increase intensity or duration. Match the workout focus when possible.

OUTPUT RULES — VERY IMPORTANT:
- Return ONLY valid JSON, no markdown, no preamble, no explanation outside the JSON.
- JSON shape:
{
  "message": "Short 1-2 sentence Coach X response, intense and direct, like: 'Got it. Stripped the rim drills, added more handle work. Run it.'",
  "proposedDrills": [
    { "name": "Drill name", "time": "5 min" },
    ...
  ]
}
- "name" must be a real basketball drill name (e.g. "Pound dribble", "Form shooting", "Defensive slides", "Mikan layups", "Stationary crossovers", "Tennis ball drops")
- "time" must be in format "X min" (e.g. "5 min", "10 min")
- 3 to 8 drills total
- Match the workout focus when possible
- No emojis, no markdown in message
- Coach X never says "great question" or apologizes. He just gets the work done.`;

    // Build messages history for continuity (last few turns)
    const history = (recentMessages || []).slice(-6).map(m => ({
      role: m.role === 'coach' ? 'assistant' : 'user',
      content: m.text,
    }));

    const messages = [
      ...history,
      { role: 'user', content: userRequest },
    ];

    const anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 800,
        system: systemPrompt,
        messages,
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('Anthropic error:', anthropicRes.status, errText);
      return res.status(502).json({ error: 'AI service error' });
    }

    const data = await anthropicRes.json();
    const raw = data?.content?.[0]?.text || '';

    // Strip markdown fences if Haiku wrapped the JSON (it sometimes does)
    let cleaned = raw.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('JSON parse failed. Raw:', raw);
      return res.status(502).json({
        error: 'Coach X response was malformed. Try again.',
      });
    }

    // Light validation
    if (!parsed || !Array.isArray(parsed.proposedDrills)) {
      return res.status(502).json({ error: 'Invalid proposal shape' });
    }

    // Normalize proposed drills
    const proposedDrills = parsed.proposedDrills
      .filter(d => d && typeof d.name === 'string')
      .slice(0, 8)
      .map(d => ({
        name: String(d.name).trim(),
        time: String(d.time || '5 min').trim(),
      }));

    return res.status(200).json({
      message: String(parsed.message || 'Here is your updated workout.').trim(),
      proposedDrills,
    });
  } catch (err) {
    console.error('coach-x-edit error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
