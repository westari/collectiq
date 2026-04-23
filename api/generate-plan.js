import Anthropic from "@anthropic-ai/sdk";
import { applySecurity } from './_middleware.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  // ---------- SECURITY CHECKS ----------
  // Handles CORS, OPTIONS preflight, method check, API secret, rate limiting.
  // Plan generation costs API $, so rate-limit harder: 10 plans per IP per hour.
  const security = applySecurity(req, res, {
    rateLimit: 10,
    rateLimitWindowMs: 60 * 60 * 1000,
    maxBodySize: 512 * 1024, // 512 KB — plans are small JSON payloads
  });
  if (!security.ok) return; // response already sent

  // ---------- VALIDATE INPUT ----------
  const {
    sport, position, experience, goal, weakness,
    driving, leftHand, pressure, goToMove, threeConfidence, freeThrow,
    frequency, duration, access, skillLevels, description,
    grade, schoolTeam, playsAAU, aauCircuit, aauStarter,
    starter, collegeLevel, adultPlay, role, stats,
    shootingMakes, dribbling,
  } = req.body || {};

  if (!sport || !position || !frequency || !duration || !access) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // ---------- BUILD PROMPT ----------
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
    const strongest = sorted.slice(-3).reverse().map(([k, v]) => (SKILL_LABELS[k] || k) + ': ' + v + '/10').join(', ');
    const allScores = Object.entries(skillLevels).map(([k, v]) => (SKILL_LABELS[k] || k) + ': ' + v).join(', ');

    skillSection = `

COACH X ASSESSMENT (from their onboarding answers):
ALL SKILL LEVELS: ${allScores}
WEAKEST 3 SKILLS (focus most drills here): ${weakest}
STRONGEST 3 SKILLS (build on these): ${strongest}

CRITICAL: These skill levels were estimated from the player's self-reported shooting makes (layups, free throws, mid-range, threes), dribbling assessment, role, position, and competitive level. Build the plan to attack the weakest skills hardest — at least 60% of skill drills should target the bottom 3 skills.

In coachSummary.assessment, talk directly to the player. Reference their weakest skills by name, acknowledge their strongest. Be direct and honest. Use language like "based on what you told me" or "from your answers" — do NOT claim you watched their film or video.`;
  }

  let levelContext = '';
  if (grade) {
    const levelBits = [];
    levelBits.push(`Grade: ${grade}`);
    if (schoolTeam && schoolTeam !== 'No school team') levelBits.push(`School team: ${schoolTeam}`);
    if (playsAAU === 'Yes' && aauCircuit) levelBits.push(`AAU circuit: ${aauCircuit}`);
    if (collegeLevel && collegeLevel !== 'No college team') levelBits.push(`College level: ${collegeLevel}`);
    if (adultPlay) levelBits.push(`Playing context: ${adultPlay}`);
    if (role) levelBits.push(`Team role: ${role}`);
    if (starter || aauStarter) levelBits.push(`Status: ${starter || aauStarter}`);
    if (stats && Object.keys(stats).length > 0) {
      const statLine = Object.entries(stats).filter(([, v]) => v).map(([k, v]) => `${v} ${k}`).join(', ');
      if (statLine) levelBits.push(`Stats: ${statLine}`);
    }
    levelContext = levelBits.length > 0 ? `\n\nCOMPETITIVE CONTEXT:\n${levelBits.join('\n')}` : '';
  }

  const fields = [
    ['DRIVING', driving],
    ['LEFT HAND', leftHand],
    ['UNDER PRESSURE', pressure],
    ['GO-TO MOVE', goToMove],
    ['THREE CONFIDENCE', threeConfidence],
    ['FREE THROW', freeThrow],
  ].filter(([, v]) => v && v !== 'not specified');
  const fieldLines = fields.length > 0 ? '\n' + fields.map(([k, v]) => `${k}: ${v}`).join('\n') : '';

  let makesLine = '';
  if (shootingMakes) {
    const parts = [];
    if (shootingMakes.layupStrong != null && shootingMakes.layupStrong !== '') parts.push(`layups strong: ${shootingMakes.layupStrong}/10`);
    if (shootingMakes.layupWeak != null && shootingMakes.layupWeak !== '') parts.push(`layups weak: ${shootingMakes.layupWeak}/10`);
    if (shootingMakes.freeThrows != null && shootingMakes.freeThrows !== '') parts.push(`FTs: ${shootingMakes.freeThrows}/10`);
    if (shootingMakes.midRange != null && shootingMakes.midRange !== '') parts.push(`mid-range: ${shootingMakes.midRange}/10`);
    if (shootingMakes.threes != null && shootingMakes.threes !== '') parts.push(`threes: ${shootingMakes.threes}/10`);
    if (parts.length > 0) makesLine = `\nSHOOTING MAKES (out of 10 wide open): ${parts.join(', ')}`;
  }

  const dribblingLine = dribbling ? `\nDRIBBLING: ${dribbling}` : '';

  const prompt = `You are Coach X, an elite basketball trainer talking directly to a player. Build a personalized weekly training plan.

PLAYER: ${position}, ${experience || 'unknown experience'}
${description ? 'DESCRIBED AS: ' + description : ''}
STATED GOAL (what they want to improve): ${goal || 'become a more complete player'}
ANALYZED WEAKNESS (from their data): ${weakness || 'overall game'}${fieldLines}${makesLine}${dribblingLine}
FREQUENCY: ${frequency}
SESSION LENGTH: ${duration}
FACILITIES: ${Array.isArray(access) ? access.join(', ') : access}${levelContext}${skillSection}

RULES:
1. Session duration MUST match "${duration}" exactly
2. Prioritize the STATED GOAL, but make sure at least 30% of skill drills also target the ANALYZED WEAKNESS
3. If the player reported weak hand issues, include weak-hand drills EVERY session
4. Rest days based on "${frequency}" — fewer train days = more rest
5. 6-10 drills per session: warmup first (1-2 drills), skills middle (4-6 drills), conditioning last (1-2 drills)
6. CRITICAL: Day "focus" must be SHORT (1-3 words max). Examples: "Ball Handling", "Defense", "Left Hand", "Shooting", "Finishing". NEVER use long descriptive titles.
7. coachSummary.assessment should sound like Coach X talking directly to the player, 2-3 sentences. Reference their actual weaknesses by name. Do NOT claim you watched their film — you reviewed their answers.
8. Include a "primarySkill" field on each drill (one of: ballHandling, shooting, shotForm, finishing, weakHand, defense, iq, athleticism, creativity, touch, courtVision, decisionMaking)

Return ONLY valid JSON, no markdown, no backticks:
{"weekTitle":"Week 1: Short Theme","aiInsight":"...","coachSummary":{"greeting":"...","assessment":"Coach X talking directly to player","planOverview":"...","motivation":"..."},"days":[{"day":"Mon","date":"","focus":"SHORT (1-3 words)","duration":"... min","isRest":false,"drills":[{"name":"...","time":"... min","type":"warmup|skill|shooting|conditioning","primarySkill":"shooting","detail":"..."}]}]}

Include all 7 days Mon-Sun. Rest days: isRest true, drills empty array, duration "---".`;

  // ---------- CALL CLAUDE WITH RETRY ----------
  try {
    let plan = null;
    let attempts = 0;
    let lastError = null;

    while (!plan && attempts < 2) {
      attempts++;

      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 6000,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      });

      const responseText = message.content[0].text;

      try {
        const start = responseText.indexOf('{');
        const end = responseText.lastIndexOf('}');
        if (start === -1 || end === -1) throw new Error('No JSON object found');
        const jsonString = responseText.substring(start, end + 1);
        plan = JSON.parse(jsonString);

        if (Array.isArray(plan.days)) {
          plan.days = plan.days.map(d => ({
            ...d,
            isRest: d.isRest === true || d.isRest === 'true',
          }));
        } else {
          throw new Error('No days array in plan');
        }

        if (plan.days.length !== 7) {
          throw new Error(`Plan returned ${plan.days.length} days, expected 7`);
        }
      } catch (parseError) {
        lastError = parseError;
        plan = null;
        console.error(`Parse failed on attempt ${attempts}:`, parseError.message);
        if (attempts >= 2) {
          return res.status(500).json({
            error: 'Failed to parse training plan after retry',
            detail: parseError.message,
          });
        }
      }
    }

    return res.status(200).json(plan);
  } catch (error) {
    console.error('Claude API error:', error);
    return res.status(500).json({ error: 'Failed to generate training plan', detail: error.message });
  }
}
