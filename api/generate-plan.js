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
  let assessmentMode = 'quiz_only';

  if (skillLevels && Object.keys(skillLevels).length > 0) {
    assessmentMode = 'with_film';
    const SKILL_LABELS = {
      ballHandling: 'Ball Handling', shooting: 'Shooting', shotForm: 'Shot Form',
      finishing: 'Finishing', defense: 'Defense', iq: 'Basketball IQ',
      athleticism: 'Athleticism', weakHand: 'Weak Hand', creativity: 'Creativity',
      touch: 'Touch', courtVision: 'Court Vision', decisionMaking: 'Decision Making',
    };
    const sorted = Object.entries(skillLevels).sort((a, b) => a[1] - b[1]);
    const allScores = sorted.map(([k, v]) => (SKILL_LABELS[k] || k) + ': ' + v + '/10').join(', ');
    const drillTargets = sorted.filter(([k, v]) => v < 7).slice(0, 3).map(([k, v]) => (SKILL_LABELS[k] || k) + ' (' + v + '/10)').join(', ') || 'none — player is solid across the board';
    const strongest = sorted.slice(-3).reverse().map(([k, v]) => (SKILL_LABELS[k] || k) + ' (' + v + '/10)').join(', ');

    skillSection = `

COACH X ASSESSMENT (from watching their actual film):
SKILLS SCORED: ${allScores}
SKILLS THAT NEED WORK (below 7/10): ${drillTargets}
STRONGEST SKILLS (build on these, do NOT drill these): ${strongest}

CRITICAL RULES based on assessment:
1. ONLY generate skill drills for skills scored below 7/10. A score of 7+ means the player is already solid — DO NOT waste their time drilling it. Acknowledge it instead.
2. If a skill is NOT in the SKILLS SCORED list above, it was not visible in any clip. DO NOT generate drills for it unless it matches the player's stated weakness ("${weakness}").
3. If the player has fewer than 3 skills below 7/10, fill remaining drill time with their stated weakness ("${weakness}") and conditioning.
4. In coachSummary.assessment, talk to the player like you just watched them. Reference SPECIFIC skills you saw with their actual scores. Mention strengths AND weaknesses. Be direct, honest, and encouraging. DO NOT make up things you didn't see — only reference skills from the SKILLS SCORED list.`;
  } else {
    skillSection = `

NO FILM ASSESSMENT AVAILABLE - quiz only.
The player did not upload film or assessment failed. Build the plan from quiz answers only.
In coachSummary.assessment, DO NOT pretend to have watched film. Say something like "I haven't seen you play yet, but based on what you told me..." Be honest that this is a starter plan and will improve once they upload film.`;
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
2. If left hand is weak, include left-hand drills EVERY session
3. Include rest days based on "${frequency}"
4. 6-10 drills per session: warmup first, skills middle, conditioning last
5. CRITICAL: Day "focus" must be SHORT (1-3 words max). Examples: "Ball Handling", "Defense", "Left Hand", "Shooting", "Finishing". NEVER long descriptive titles.
6. coachSummary.assessment should sound like Coach X talking directly to the player, 2-3 sentences

Return ONLY valid JSON, no markdown, no backticks:
{"weekTitle":"Week 1: Short Theme","aiInsight":"...","coachSummary":{"greeting":"...","assessment":"Coach X talking directly to player","planOverview":"...","motivation":"..."},"days":[{"day":"Mon","date":"","focus":"SHORT (1-3 words)","duration":"... min","isRest":false,"drills":[{"name":"...","time":"... min","type":"warmup|skill|shooting|conditioning","detail":"..."}]}]}

Include all 7 days Mon-Sun. Rest days: isRest true, drills empty array, duration "---".`;

  console.log('generate-plan mode:', assessmentMode, 'skillLevels:', JSON.stringify(skillLevels || {}));

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
