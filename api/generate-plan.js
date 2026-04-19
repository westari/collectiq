import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const config = {
  maxDuration: 60,
};

// Compact drill library — must match expo/constants/drills.ts IDs exactly
const DRILL_LIBRARY = {
  ballHandling: [
    'bh-1: Pound Dribbles', 'bh-2: Alternating Pound Dribbles', 'bh-3: In & Out Dribble',
    'bh-4: Crossover Dribble', 'bh-5: Between the Legs Dribble', 'bh-6: Behind the Back Dribble',
    'bh-7: Figure 8 Dribble', 'bh-8: Spider Dribble', 'bh-9: Two Ball Pound Dribble',
    'bh-10: Two Ball Alternating Dribble', 'bh-11: Two Ball Crossover', 'bh-12: Cone Zig-Zag Dribble',
    'bh-13: Retreat Dribble', 'bh-14: Hesitation Dribble', 'bh-15: Speed Dribble',
    'bh-16: Stationary Combo Dribbles', 'bh-17: Tennis Ball Dribble', 'bh-18: Full Court Speed Dribble',
    'bh-19: Chair Change of Direction Drill', 'bh-20: Weak Hand Only Dribble', 'bh-21: Circle Dribble Drill',
    'bh-22: Dribble Knockout', 'bh-23: Tight Space Dribbling', 'bh-24: Two Ball High-Low Dribble',
    'bh-25: Attack Cone Dribble', 'bh-26: Move Chaining Drill', 'bh-27: Random Move Drill',
    'bh-28: Counter Move Drill', 'bh-29: Live Ball Improvisation Drill', 'bh-30: Weak Hand Combo Series',
  ],
  shooting: [
    'sh-1: Form Shooting', 'sh-2: One Hand Form Shooting', 'sh-3: BEEF Shooting Drill',
    'sh-4: Around the World', 'sh-5: Spot Shooting', 'sh-6: Catch and Shoot',
    'sh-7: Off the Dribble Pull Up', 'sh-8: 5 Spot Shooting', 'sh-9: Mikan Shooting Drill',
    'sh-10: Elbow Shooting', 'sh-11: Corner Shooting', 'sh-12: Wing Shooting',
    'sh-13: Free Throw Routine', 'sh-14: Chair Curl Shooting', 'sh-15: Fadeaway Shooting',
    'sh-16: Step Back Shooting', 'sh-17: Pump Fake One Dribble Shot', 'sh-18: Transition Pull Up',
    'sh-19: Relocation Shooting', 'sh-20: Partner Pass Shooting', 'sh-21: Closeout Shooting',
    'sh-22: Quick Release Shooting', 'sh-23: Shooting Off Screens', 'sh-24: 3 Point Spot Shooting',
    'sh-25: 100 Makes Shooting Drill', 'sh-26: Elbow Alignment Drill', 'sh-27: Guide Hand Removal Drill',
    'sh-28: Dip Fix Drill',
  ],
  finishing: [
    'fn-1: Mikan Drill', 'fn-2: Reverse Mikan Drill', 'fn-3: Power Layups',
    'fn-4: Weak Hand Layups', 'fn-5: Euro Step Finish', 'fn-6: Spin Move Finish',
    'fn-7: Floater Drill', 'fn-8: Runner Finish', 'fn-9: Contact Layups',
    'fn-10: Cone Layups', 'fn-11: Baseline Reverse Layups', 'fn-12: Inside Hand Finish',
    'fn-13: Outside Hand Finish', 'fn-14: Pro Hop Finish', 'fn-15: Hop Step Finish',
    'fn-16: Two Foot Finish', 'fn-17: One Foot Finish', 'fn-18: Up and Under Finish',
    'fn-19: Putback Finishes', 'fn-20: Transition Layups', 'fn-21: Chair Finish Drill',
    'fn-22: Defender Pad Finishes', 'fn-23: High Glass Finish', 'fn-24: Drop Step Finish',
    'fn-25: Post Move Finish', 'fn-26: Weak Hand Finishing Series', 'fn-27: Mid-Range Touch Drill',
  ],
  defense: [
    'df-1: Defensive Slide Drill', 'df-2: Closeout Drill', 'df-3: Shell Drill',
    'df-4: Mirror Drill', 'df-5: Zig-Zag Defensive Slides', 'df-6: Charge Drill',
    'df-7: Box Out Drill', 'df-8: Rebound and Outlet Drill', 'df-9: 1 on 1 Full Court Defense',
    'df-10: Deny the Wing Drill', 'df-11: Help Side Defense Drill', 'df-12: Defensive Stance Holds',
    'df-13: Reaction Closeouts', 'df-14: Ball Pressure Drill', 'df-15: Trap Drill',
    'df-16: Recover Drill', 'df-17: Defensive Shuffle Sprint Drill', 'df-18: Loose Ball Dive Drill',
    'df-19: Contest Without Fouling Drill', 'df-20: Foot Fire Drill', 'df-21: Lane Line Slides',
    'df-22: Backpedal Sprint Drill', 'df-23: Defensive Mirror Slides', 'df-24: Tip Drill',
    'df-25: Rebound War Drill',
  ],
  speedAgility: [
    'sa-1: Ladder Quick Feet', 'sa-2: Ladder In and Outs', 'sa-3: Ladder Icky Shuffle',
    'sa-4: Cone Shuttle Drill', 'sa-5: 5-10-5 Shuttle Run', 'sa-6: Suicide Runs',
    'sa-7: Cone Zig-Zag Sprint', 'sa-8: Defensive Slide Sprints', 'sa-9: Backpedal Sprint Drill',
    'sa-10: Lateral Cone Hops', 'sa-11: Single Leg Bounds', 'sa-12: Broad Jumps',
    'sa-13: Sprint and Backpedal', 'sa-14: Reaction Sprint Drill', 'sa-15: T Drill',
    'sa-16: Box Drill', 'sa-17: Line Hops', 'sa-18: Carioca Drill',
    'sa-19: Sprint Turn Sprint', 'sa-20: Resistance Band Sprints', 'sa-21: Partner Reaction Drill',
    'sa-22: Quick Drop Step Drill', 'sa-23: Shuffle Sprint Shuffle', 'sa-24: Jump Stop Sprint Drill',
    'sa-25: Acceleration Sprints',
  ],
  warmup: [
    'wu-1: High Knees', 'wu-2: Butt Kicks', 'wu-3: Walking Lunges',
    'wu-4: Leg Swings', 'wu-5: Arm Circles', 'wu-6: Hip Openers',
    'wu-7: Hamstring Stretch', 'wu-8: Quad Stretch', 'wu-9: Calf Stretch',
    'wu-10: Groin Stretch', 'wu-11: Ankle Mobility Drill', 'wu-12: Dynamic Toe Touch',
    'wu-13: Side Lunges', 'wu-14: Jump Rope Warmup', 'wu-15: Light Form Shooting Warmup',
    'wu-16: Jog and Backpedal', 'wu-17: Defensive Slides Warmup', 'wu-18: Foam Rolling',
    'wu-19: Static Stretch Cooldown', 'wu-20: Deep Breathing Cooldown', 'wu-21: Mobility Flow',
    'wu-22: Frankenstein Walk', 'wu-23: Heel Walk', 'wu-24: Toe Walk',
    'wu-25: Light Layup Warmup',
  ],
  conditioning: [
    'cd-1: Suicides', 'cd-2: 17s', 'cd-3: Full Court Layups Conditioning',
    'cd-4: Lane Line Sprints', 'cd-5: Baseline Touches', 'cd-6: Continuous Fast Break Drill',
    'cd-7: 3 Minute Shooting Conditioning', 'cd-8: Rebound and Putback Drill', 'cd-9: Sprint Free Throw Drill',
    'cd-10: Closeout Conditioning Drill', 'cd-11: Defensive Slide Conditioning', 'cd-12: Jump Rope Conditioning',
    'cd-13: Hill Sprints', 'cd-14: Bleacher Runs', 'cd-15: Medicine Ball Slams',
    'cd-16: Burpee Sprints', 'cd-17: Shuttle Runs', 'cd-18: Sprint Jog Intervals',
    'cd-19: Full Court Dribble Sprints', 'cd-20: Reaction Sprint Conditioning', 'cd-21: Cone Touch Conditioning',
    'cd-22: Push Up Sprints', 'cd-23: Plank Conditioning', 'cd-24: Wall Sit Conditioning',
    'cd-25: Continuous Mikan Drill',
  ],
  basketballIQ: [
    'iq-1: Read and React Drill', 'iq-2: Advantage Disadvantage Drill', 'iq-3: Pick and Roll Read Drill',
    'iq-4: Drive and Kick Drill', 'iq-5: Help Defense Rotation Drill', 'iq-6: Transition Decision Drill',
    'iq-7: Shot Selection Drill', 'iq-8: Clock Management Drill', 'iq-9: Situational Scrimmage',
    'iq-10: 3 on 2 Continuous', 'iq-11: 4 on 3 Advantage Drill', 'iq-12: No Dribble Scrimmage',
    'iq-13: One Dribble Scrimmage', 'iq-14: Spacing Drill', 'iq-15: Backdoor Cut Drill',
    'iq-16: Give and Go Drill', 'iq-17: Closeout Decision Drill', 'iq-18: Extra Pass Drill',
    'iq-19: Skip Pass Drill', 'iq-20: Offensive Rebound Decision Drill', 'iq-21: End of Game Situations',
    'iq-22: Press Break Drill', 'iq-23: Zone Offense Drill', 'iq-24: Defensive Communication Drill',
    'iq-25: Film Study Session', 'iq-26: Head Up Dribble Drill', 'iq-27: Scan and Pass Drill',
    'iq-28: Peripheral Vision Drill',
  ],
};

// Maps the library category keys to our 12 skill_state categories
const CATEGORY_TO_SKILL = {
  ballHandling: 'ballHandling',
  shooting: 'shooting',
  finishing: 'finishing',
  defense: 'defense',
  speedAgility: 'athleticism',
  warmup: 'athleticism',
  conditioning: 'athleticism',
  basketballIQ: 'iq',
};

function buildLibraryString() {
  let s = '';
  for (const [category, drills] of Object.entries(DRILL_LIBRARY)) {
    const skillTag = CATEGORY_TO_SKILL[category] || category;
    s += '\n' + category.toUpperCase() + ' (primarySkill: "' + skillTag + '"):\n' + drills.join('\n') + '\n';
  }
  return s;
}

// Stats benchmark reference — helps Claude interpret raw stats in context
const STATS_BENCHMARK = `
STATS BENCHMARK REFERENCE (use this to interpret the player's stats in context):

TIER 1 — Elite (Nike EYBL, UAA, Adidas 3SSB, D1 College)
Scorers: Star 15+ ppg / Starter 7-15 ppg / Rotation 3-8 ppg / Bench 1-4 ppg (still elite skill)
Playmakers (PG): Star 5+ apg / Starter 3-5 apg / Rotation 1-3 apg
Rebounders (big): Star 7+ rpg / Starter 4-7 rpg / Rotation 2-4 rpg
KEY: Just making the roster = elite skill. 3 ppg EYBL bench > 20 ppg rec league scorer.

TIER 2 — High Competitive (Puma Pro 16, New Balance, other shoe, Made Hoops, AGame, HS Varsity, D2/D3)
Scorers: Star 12+ ppg / Starter 5-12 ppg / Rotation 2-6 ppg / Bench 0-3 ppg
Playmakers: Star 4+ apg / Starter 2-4 apg
Rebounders: Star big 6+ rpg / Starter big 3-6 rpg
KEY: Stats similar to T1 — good scorers score anywhere, just weaker comp.

TIER 3 — Mid Competitive (Local AAU, HS JV, JUCO, strong middle school AAU)
Scorers: Star 15+ ppg (often higher, weaker D) / Starter 6-12 ppg / Rotation 3-7 ppg / Bench 0-3 ppg
Playmakers: Star 4+ apg / Starter 2-4 apg
Rebounders: Star big 7+ rpg / Starter big 4-7 rpg
KEY: Scoring inflates. 20 ppg T3 star ≈ 12 ppg T1 rotation.

TIER 4 — Developing (HS Freshman, weak middle school, intramural, rec, church league)
Scorers: Top 12+ ppg / Contributor 4-10 ppg / Role <4 ppg
Playmakers: Top 3+ apg / Contributor 1-3 apg
Rebounders: Top big 6+ rpg / Contributor big 3-6 rpg
KEY: Stats mean less here. Weight self-reported goal and weakness more than numbers.

MINUTES CONTEXT:
- 2-10 min/game: End of bench. At T1 still a skill signal. At T3-T4 weak.
- 10-20 min/game: Rotation. Use per-30 stats (stat / minutes × 30).
- 20-28 min/game: Starter. Stats representative.
- 28+ min/game: Star or full-time starter. Stats = true output.

ROLE WEIGHTING (don't punish role players):
- PG with low ppg + high apg = GOOD, not weak shooter.
- Big with low ppg + high rpg = GOOD, rate finishing/rebounding up.
- Wing with high ppg + low apg = scorer, normal.
- Balanced stats = high BBIQ signal.
`;

// Build the "how they play" section from the new onboarding fields
function buildWhereYouPlaySection(body) {
  const lines = [];

  if (body.grade) lines.push('Grade: ' + body.grade);

  // Determine tier from circuit + school team + college level
  let tier = null;
  if (body.aauCircuit === 'Top shoe circuit') tier = 1;
  else if (body.aauCircuit === 'Mid shoe circuit' || body.aauCircuit === 'Independent circuit') tier = 2;
  else if (body.aauCircuit === 'Local circuit') tier = 3;

  if (body.schoolTeam === 'Varsity' && !tier) tier = 2;
  else if (body.schoolTeam === 'JV' && (!tier || tier > 3)) tier = 3;
  else if ((body.schoolTeam === 'Freshman team' || body.schoolTeam === 'Middle school team') && (!tier || tier > 4)) tier = 4;

  if (body.collegeLevel === 'D1' && !tier) tier = 1;
  else if ((body.collegeLevel === 'D2' || body.collegeLevel === 'D3') && (!tier || tier > 2)) tier = 2;
  else if ((body.collegeLevel === 'JUCO' || body.collegeLevel === 'NAIA') && (!tier || tier > 3)) tier = 3;
  else if ((body.collegeLevel === 'Club / intramural') && (!tier || tier > 4)) tier = 4;

  if (body.adultPlay === 'Competitive rec league' && !tier) tier = 3;
  else if ((body.adultPlay === 'Casual rec league' || body.adultPlay === 'Pickup / open gym') && !tier) tier = 4;

  if (tier) lines.push('Competition Tier: ' + tier + ' (see benchmark reference)');

  // Team membership
  if (body.schoolTeam && body.schoolTeam !== 'No school team') {
    lines.push('School team: ' + body.schoolTeam + ' (' + (body.starter || 'role unspecified') + ')');
  }
  if (body.playsAAU === 'Yes' && body.aauCircuit) {
    lines.push('AAU: ' + body.aauCircuit + ' (' + (body.aauStarter || 'role unspecified') + ')');
  }
  if (body.collegeLevel && body.collegeLevel !== 'No college team') {
    lines.push('College: ' + body.collegeLevel + ' (' + (body.starter || 'role unspecified') + ')');
  }
  if (body.adultPlay) {
    lines.push('Plays: ' + body.adultPlay);
  }

  // Role
  if (body.role) lines.push('Role: ' + body.role);

  // Stats
  if (body.stats) {
    const s = body.stats;
    const statParts = [];
    if (s.minutes) statParts.push(s.minutes + ' min/game');
    if (s.ppg) statParts.push(s.ppg + ' PPG');
    if (s.apg) statParts.push(s.apg + ' APG');
    if (s.rpg) statParts.push(s.rpg + ' RPG');
    if (statParts.length > 0) {
      lines.push('Stats: ' + statParts.join(', '));
      // Compute per-30 if minutes present
      const mins = parseFloat(s.minutes);
      if (mins && mins < 20) {
        const per30 = [];
        if (s.ppg) per30.push('PPG: ' + ((parseFloat(s.ppg) / mins) * 30).toFixed(1));
        if (s.apg) per30.push('APG: ' + ((parseFloat(s.apg) / mins) * 30).toFixed(1));
        if (s.rpg) per30.push('RPG: ' + ((parseFloat(s.rpg) / mins) * 30).toFixed(1));
        if (per30.length > 0) lines.push('Per-30 (extrapolated due to low minutes): ' + per30.join(', '));
      }
    } else {
      lines.push('Stats: not provided');
    }
  }

  return lines.length > 0 ? lines.join('\n') : 'No league info provided';
}

// Build the shooting makes section
function buildShootingSection(body) {
  if (!body.shootingMakes) return '';
  const m = body.shootingMakes;
  const lines = [];
  if (m.layupStrong !== undefined && m.layupStrong !== '') lines.push('Strong-hand layups: ' + m.layupStrong + '/10');
  if (m.layupWeak !== undefined && m.layupWeak !== '') lines.push('Weak-hand layups: ' + m.layupWeak + '/10');
  if (m.freeThrows !== undefined && m.freeThrows !== '') lines.push('Free throws: ' + m.freeThrows + '/10');
  if (m.midRange !== undefined && m.midRange !== '') lines.push('Mid-range: ' + m.midRange + '/10');
  if (m.threes !== undefined && m.threes !== '') lines.push('3-pointers: ' + m.threes + '/10');
  if (lines.length === 0) return '';
  return `
SHOOTING MAKES (out of 10 wide open shots — player self-report):
${lines.join('\n')}
Interpret: 7-10 = strong, 4-6 = developing, 0-3 = weakness. These are self-reported so treat as directional, not gospel.`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body;
  const { sport, position, experience, goal, weakness, driving, leftHand, pressure, goToMove, threeConfidence, freeThrow, frequency, duration, access, skillLevels, description, dribbling } = body;

  if (!sport || !position || !goal || !frequency || !duration || !access) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Context sections from new onboarding
  const whereSection = buildWhereYouPlaySection(body);
  const shootingSection = buildShootingSection(body);

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

COACH X ASSESSMENT (from a film analyst who watched their clips):
SKILLS SCORED: ${allScores}
SKILLS THAT NEED WORK (below 7/10): ${drillTargets}
STRONGEST SKILLS (build on these, do NOT drill these): ${strongest}

CRITICAL RULES based on assessment:
1. ONLY generate skill drills for skills scored below 7/10.
2. If a skill is NOT in SKILLS SCORED, don't drill it unless it matches stated weakness ("${weakness}").
3. If fewer than 3 skills below 7/10, fill remaining time with stated weakness and conditioning.

coachSummary.assessment: 2-3 sentences. Reference real scores only. DO NOT invent specific behaviors you didn't see.`;
  } else {
    skillSection = `

NO FILM ASSESSMENT — using onboarding answers only.
Build the plan from the player's self-reported info below. In coachSummary.assessment, say something like "I haven't seen you play yet, but based on what you told me..." and reference specific things they reported (their role, stats, shooting makes, etc.).`;
  }

  const libraryString = buildLibraryString();

  const prompt = `You are Coach X, an elite basketball trainer talking directly to a player. Build a personalized weekly training plan.

PLAYER: ${position}${experience ? ', ' + experience : ''}
${description ? 'DESCRIBED AS: ' + description : ''}
GOAL: ${goal}
STATED WEAKNESS: ${weakness}
DRIBBLING: ${dribbling || 'not specified'}

WHERE THEY PLAY:
${whereSection}

${shootingSection}

FREQUENCY: ${frequency}
SESSION LENGTH: ${duration}
FACILITIES: ${Array.isArray(access) ? access.join(', ') : access}
${skillSection}

${STATS_BENCHMARK}

DRILL LIBRARY (you MUST pick drills from this list — do not invent new drills):
${libraryString}

CRITICAL DRILL SELECTION RULES:
- Every drill you put in the plan MUST come from the library above.
- For each drill, you MUST return ALL THREE fields: "drillId" (e.g. "sh-1"), "name" (e.g. "Form Shooting"), AND "primarySkill" (e.g. "shooting"). Use the primarySkill tag shown in parentheses next to each category heading.
- DO NOT invent new drill names. DO NOT modify drill names. Use them EXACTLY as written.
- Use role, tier, stats, and shooting makes to shape the plan:
  * Low shooting makes → add shooting drills
  * Low weak-hand layups → add weak-hand finishing drills (fn-4, fn-26) and weak-hand handling (bh-20, bh-30)
  * "Playmaker" role → include more iq drills (iq-*), less pure scoring
  * "Defensive stopper" role → weight defense drills heavily
  * "Rebounder / rim protector" → finishing + defense + box-out heavy, less perimeter shooting
  * "Still figuring out my role" → balanced plan, lighter on specialization

PLAN STRUCTURE RULES:
1. Session duration MUST match "${duration}" exactly
2. If dribbling is weak, include a weak hand drill EVERY session (e.g. bh-20, bh-30, fn-4, fn-26)
3. Include rest days based on "${frequency}"
4. 6-10 drills per session: warmup first (from wu-* drills), skills middle, conditioning last (from cd-* drills)
5. CRITICAL: Day "focus" must be SHORT (1-3 words max). Examples: "Ball Handling", "Defense", "Left Hand", "Shooting", "Finishing". NEVER long descriptive titles.
6. Each drill needs a "time" field (e.g. "10 min")
7. coachSummary.assessment should sound like Coach X talking directly to the player, 2-3 sentences, referencing their specific role/tier/stats/makes.

Return ONLY valid JSON, no markdown, no backticks:
{"weekTitle":"Week 1: Short Theme","aiInsight":"...","coachSummary":{"greeting":"...","assessment":"Coach X talking directly to player","planOverview":"...","motivation":"..."},"days":[{"day":"Mon","date":"","focus":"SHORT (1-3 words)","duration":"... min","isRest":false,"drills":[{"drillId":"sh-1","name":"Form Shooting","primarySkill":"shooting","time":"10 min","type":"shooting","detail":"why this drill for this player"}]}]}

Include all 7 days Mon-Sun. Rest days: isRest true, drills empty array, duration "---".`;

  console.log('generate-plan mode:', assessmentMode, 'skillLevels:', JSON.stringify(skillLevels || {}));
  console.log('where section:', whereSection);

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
