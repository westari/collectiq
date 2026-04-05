import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const config = {
  maxDuration: 60,
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

  const { sport, position, experience, goal, weakness, driving, leftHand, pressure, goToMove, threeConfidence, freeThrow, frequency, duration, access } = req.body;

  if (!sport || !position || !experience || !goal || !weakness || !frequency || !duration || !access) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const prompt = `You are an elite basketball skills trainer. Build a personalized weekly training plan.

PLAYER: ${position}, ${experience} experience, goal: ${goal}
WEAKNESS: ${weakness}
DRIVING: ${driving || 'not specified'}
LEFT HAND: ${leftHand || 'not specified'}
UNDER PRESSURE: ${pressure || 'not specified'}
GO-TO MOVE: ${goToMove || 'not specified'}
THREE-POINT CONFIDENCE: ${threeConfidence || 'not specified'}
FREE THROW: ${freeThrow || 'not specified'}
FREQUENCY: ${frequency}
SESSION LENGTH: ${duration}
FACILITIES: ${Array.isArray(access) ? access.join(', ') : access}

RULES:
1. Session duration MUST match "${duration}" exactly
2. 60%+ of skill drills must target "${weakness}"
3. If left hand is weak, include left-hand drills EVERY session
4. Include rest days based on "${frequency}"
5. 6-10 drills per session: warmup first, skills middle, conditioning last
6. Name days specifically (e.g. "Left Hand Finishing" not "Skills Day")

Return ONLY valid JSON, no markdown, no backticks, no extra text:
{"weekTitle":"Week 1: ...","aiInsight":"...","coachSummary":{"greeting":"...","assessment":"...","planOverview":"...","motivation":"..."},"days":[{"day":"Mon","date":"","focus":"...","duration":"... min","isRest":false,"drills":[{"name":"...","time":"... min","type":"warmup|skill|shooting|conditioning","detail":"..."}]}]}

Include all 7 days Mon-Sun. Rest days: isRest true, drills empty array, duration "---".`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = message.content[0].text;

    let plan;
    try {
      var start = responseText.indexOf('{');
      var end = responseText.lastIndexOf('}');
      if (start === -1 || end === -1) {
        throw new Error('No JSON object found');
      }
      var jsonString = responseText.substring(start, end + 1);
      plan = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Parse error. Raw response:', responseText.substring(0, 200));
      return res.status(500).json({ error: 'Failed to parse training plan' });
    }

    return res.status(200).json(plan);
  } catch (error) {
    console.error('Claude API error:', error);
    return res.status(500).json({ error: 'Failed to generate training plan' });
  }
}
