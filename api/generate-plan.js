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

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { sport, position, experience, goal, weakness, driving, leftHand, pressure, goToMove, threeConfidence, freeThrow, frequency, duration, access, skillLevels, description } = req.body;

  if (!sport || !position || !experience || !goal || !weakness || !frequency || !duration || !access) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let skillSection = '';
  if (skillLevels && Object.keys(skillLevels).length > 0) {
    const SKILL_LABELS = {
      ballHandling: 'Ball Handling', shooting: 'Shooting', shotForm: 'Shot Form',
      finishing: 'Finishing', defense: 'Defense', iq: 'Basketball IQ',
      athleticism: 'Athleticism', weakHand: 'Weak Hand', creativity: 'Creativity',
      touch: 'Touch', courtVision: 'Court Vision', decisionMaking: 'Decision Making',
    };
    const sorted = Object.entries(skillLevels).sort((a, b) => a[1] - b[1]);
    const weakest = sorted.slice(0, 3).map(([k, v]) => (SKILL_LABELS[k] || k) + ' (' + v + '/10)').join(', ');
    const strongest = sorted.slice(-3).reverse().map(([k, v]) => (SKILL_LABELS[k] || k) + ' (' + v + '/10)').join(', ');
    const allScores = Object.entries(skillLevels).map(([k, v]) => (SKILL_LABELS[k] || k) + ': ' + v).join(', ');

    skillSection = `

COACH X ASSESSMENT (from watching their actual film):
ALL SKILL LEVELS: ${allScores}
WEAKEST 3 SKILLS (focus most drills here): ${weakest}
STRONGEST 3 SKILLS (build on these): ${strongest}

CRITICAL: This player was watched on film. Build the plan to attack the weakest skills hardest. At least 60% of skill drills should target the bottom 3 skills. In the coachSummary.assessment, talk to the player like you just watched them - reference what you saw in their specific clips, mention their weakest skills by name, and acknowledge their strongest. Be direct, honest, and encouraging.`;
  }

  const prompt = `You are Coach X, an elite basketball trainer talking directly to a player. Build a personalized weekly training plan.

PLAYER: ${position}, ${experience} experience
${description ? 'DESCRIBED AS: ' + description : ''}
GOAL: ${goal}
STATED WEAKNESS: ${weakness}
DRIVING: ${driving || 'not specified'}
LEFT HAND: ${leftHand || 'not specified'}
UNDER PRESSURE: ${pressure || 'not specified'}
GO-TO MOVE: ${goToMove || 'not specified'}
THREE CONFIDENCE: ${threeConfidence || 'not specified'}
FREE THROW: ${freeThrow || 'not specified'}
FREQUENCY: ${frequency}
SESSION LENGTH: ${duration}
FACILITIES: ${Array.isArray(access) ? access.join(', ') : access}${skillSection}

RULES:
1. Session duration MUST match "${duration}" exactly
2. ${skillLevels && Object.keys(skillLevels).length > 0 ? 'Use the assessment scores as your primary guide' : '60%+ of skill drills must target "' + weakness + '"'}
3. If left hand is weak, include left-hand drills EVERY session
4. Include rest days based on "${frequency}"
5. 6-10 drills per session: warmup first, skills middle, conditioning last
6. CRITICAL: Day "focus" must be SHORT (1-3 words max). Examples: "Ball Handling", "Defense", "Left Hand", "Shooting", "Finishing". NEVER use long descriptive titles like "On-ball defense fundamentals + weak-hand paint finishes".
7. coachSummary.assessment should sound like Coach X talking directly to the player, 2-3 sentences, referencing what was seen on film if available

Return ONLY valid JSON, no markdown, no backticks:
{"weekTitle":"Week 1: Short Theme","aiInsight":"...","coachSummary":{"greeting":"...","assessment":"Coach X talking directly to player","planOverview":"...","motivation":"..."},"days":[{"day":"Mon","date":"","focus":"SHORT (1-3 words)","duration":"... min","isRest":false,"drills":[{"name":"...","time":"... min","type":"warmup|skill|shooting|conditioning","detail":"..."}]}]}

Include all 7 days Mon-Sun. Rest days: isRest true, drills empty array, duration "---".`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].text;
    let plan;
    try {
      var start = responseText.indexOf('{');
      var end = responseText.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('No JSON object found');
      var jsonString = responseText.substring(start, end + 1);
      plan = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Parse error:', responseText.substring(0, 200));
      return res.status(500).json({ error: 'Failed to parse training plan' });
    }
    return res.status(200).json(plan);
  } catch (error) {
    console.error('Claude API error:', error);
    return res.status(500).json({ error: 'Failed to generate training plan' });
  }
}
