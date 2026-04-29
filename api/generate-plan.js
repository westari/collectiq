import Anthropic from "@anthropic-ai/sdk";
import { applySecurity } from './_middleware.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const config = {
  maxDuration: 60,
};

// ============================================================
// DRILL LIBRARY INDEX — synced with expo/constants/drillLibrary.ts
// Coach X must pick drills BY ID from this list. He cannot invent drills.
// Format: id|name|type|difficulty|duration|primarySkill
// ============================================================
const DRILL_INDEX = `
BALL HANDLING:
bh-1|Pound Dribbles|skill|beginner|5min|ballHandling
bh-2|Alternating Pound Dribbles|skill|beginner|5min|ballHandling
bh-3|In & Out Dribble|skill|intermediate|6min|ballHandling
bh-4|Crossover Dribble|skill|beginner|8min|ballHandling
bh-5|Between the Legs Dribble|skill|intermediate|6min|ballHandling
bh-6|Behind the Back Dribble|skill|intermediate|6min|ballHandling
bh-7|Figure 8 Dribble|skill|beginner|5min|ballHandling
bh-8|Spider Dribble|skill|beginner|3min|ballHandling
bh-9|Two Ball Pound Dribble|skill|advanced|5min|weakHand
bh-10|Two Ball Alternating Dribble|skill|advanced|5min|weakHand
bh-11|Two Ball Crossover|skill|advanced|6min|weakHand
bh-12|Cone Zig-Zag Dribble|skill|beginner|8min|ballHandling
bh-13|Retreat Dribble|skill|intermediate|5min|ballHandling
bh-14|Hesitation Dribble|skill|intermediate|6min|ballHandling
bh-15|Speed Dribble|skill|beginner|5min|ballHandling
bh-16|Stationary Combo Dribbles|skill|intermediate|8min|ballHandling
bh-17|Tennis Ball Dribble|skill|advanced|5min|ballHandling
bh-18|Full Court Speed Dribble|skill|intermediate|10min|ballHandling
bh-19|Chair Change of Direction Drill|skill|intermediate|8min|ballHandling
bh-20|Weak Hand Only Dribble|skill|beginner|10min|weakHand
bh-21|Circle Dribble Drill|skill|beginner|5min|ballHandling
bh-22|Dribble Knockout|skill|beginner|10min|ballHandling
bh-23|Tight Space Dribbling|skill|advanced|8min|ballHandling
bh-24|Two Ball High-Low Dribble|skill|advanced|5min|weakHand
bh-25|Attack Cone Dribble|skill|intermediate|8min|ballHandling
bh-26|Move Chaining Drill|skill|intermediate|8min|creativity
bh-27|Random Move Drill|skill|intermediate|8min|creativity
bh-28|Counter Move Drill|skill|advanced|8min|creativity
bh-29|Live Ball Improvisation Drill|skill|advanced|10min|creativity
bh-30|Weak Hand Combo Series|skill|intermediate|8min|weakHand

SHOOTING:
sh-1|Form Shooting|shooting|beginner|5min|shotForm
sh-2|One Hand Form Shooting|shooting|beginner|5min|shotForm
sh-3|BEEF Shooting Drill|shooting|beginner|8min|shotForm
sh-4|Around the World|shooting|beginner|10min|shooting
sh-5|Spot Shooting|shooting|intermediate|12min|shooting
sh-6|Catch and Shoot|shooting|intermediate|8min|shooting
sh-7|Off the Dribble Pull Up|shooting|intermediate|10min|shooting
sh-8|5 Spot Shooting|shooting|intermediate|12min|shooting
sh-9|Mikan Shooting Drill|shooting|beginner|5min|touch
sh-10|Elbow Shooting|shooting|beginner|6min|shooting
sh-11|Corner Shooting|shooting|intermediate|8min|shooting
sh-12|Wing Shooting|shooting|intermediate|8min|shooting
sh-13|Free Throw Routine|shooting|beginner|10min|touch
sh-14|Chair Curl Shooting|shooting|intermediate|10min|shooting
sh-15|Fadeaway Shooting|shooting|advanced|8min|shooting
sh-16|Step Back Shooting|shooting|advanced|8min|shooting
sh-17|Pump Fake One Dribble Shot|shooting|intermediate|8min|shooting
sh-18|Transition Pull Up|shooting|intermediate|8min|shooting
sh-19|Relocation Shooting|shooting|intermediate|8min|shooting
sh-20|Partner Pass Shooting|shooting|beginner|10min|shooting
sh-21|Closeout Shooting|shooting|advanced|8min|decisionMaking
sh-22|Quick Release Shooting|shooting|advanced|8min|shooting
sh-23|Shooting Off Screens|shooting|advanced|10min|shooting
sh-24|3 Point Spot Shooting|shooting|intermediate|10min|shooting
sh-25|100 Makes Shooting Drill|shooting|intermediate|20min|shooting
sh-26|Elbow Alignment Drill|shooting|beginner|6min|shotForm
sh-27|Guide Hand Removal Drill|shooting|beginner|6min|shotForm
sh-28|Dip Fix Drill|shooting|intermediate|6min|shotForm

FINISHING:
fn-1|Mikan Drill|skill|beginner|5min|finishing
fn-2|Reverse Mikan Drill|skill|intermediate|5min|finishing
fn-3|Power Layups|skill|beginner|8min|finishing
fn-4|Weak Hand Layups|skill|beginner|10min|weakHand
fn-5|Euro Step Finish|skill|intermediate|8min|finishing
fn-6|Spin Move Finish|skill|advanced|8min|finishing
fn-7|Floater Drill|skill|intermediate|8min|touch
fn-8|Runner Finish|skill|intermediate|8min|touch
fn-9|Contact Layups|skill|advanced|8min|finishing
fn-10|Cone Layups|skill|beginner|8min|finishing
fn-11|Baseline Reverse Layups|skill|intermediate|8min|finishing
fn-12|Inside Hand Finish|skill|intermediate|6min|finishing
fn-13|Outside Hand Finish|skill|intermediate|6min|finishing
fn-14|Pro Hop Finish|skill|intermediate|8min|finishing
fn-15|Hop Step Finish|skill|intermediate|8min|finishing
fn-16|Two Foot Finish|skill|beginner|6min|finishing
fn-17|One Foot Finish|skill|beginner|6min|finishing
fn-18|Up and Under Finish|skill|advanced|8min|finishing
fn-19|Putback Finishes|skill|intermediate|8min|finishing
fn-20|Transition Layups|skill|beginner|8min|finishing
fn-21|Chair Finish Drill|skill|intermediate|8min|finishing
fn-22|Defender Pad Finishes|skill|advanced|8min|finishing
fn-23|High Glass Finish|skill|beginner|6min|touch
fn-24|Drop Step Finish|skill|intermediate|8min|finishing
fn-25|Post Move Finish|skill|advanced|10min|finishing
fn-26|Weak Hand Finishing Series|skill|intermediate|10min|weakHand
fn-27|Mid-Range Touch Drill|skill|intermediate|8min|touch

DEFENSE:
df-1|Defensive Slide Drill|skill|beginner|8min|defense
df-2|Closeout Drill|skill|intermediate|8min|defense
df-3|Shell Drill|skill|intermediate|15min|defense
df-4|Mirror Drill|skill|intermediate|6min|defense
df-5|Zig-Zag Defensive Slides|skill|beginner|5min|defense
df-6|Charge Drill|skill|intermediate|8min|defense
df-7|Box Out Drill|skill|beginner|8min|defense
df-8|Rebound and Outlet Drill|skill|intermediate|8min|defense
df-9|1 on 1 Full Court Defense|skill|advanced|10min|defense
df-10|Deny the Wing Drill|skill|intermediate|8min|defense
df-11|Help Side Defense Drill|skill|advanced|8min|defense
df-12|Defensive Stance Holds|skill|beginner|5min|defense
df-13|Reaction Closeouts|skill|advanced|8min|defense
df-14|Ball Pressure Drill|skill|intermediate|8min|defense
df-15|Trap Drill|skill|advanced|8min|defense
df-16|Recover Drill|skill|intermediate|6min|defense
df-17|Defensive Shuffle Sprint Drill|skill|intermediate|5min|defense
df-18|Loose Ball Dive Drill|skill|intermediate|5min|defense
df-19|Contest Without Fouling Drill|skill|intermediate|8min|defense
df-20|Foot Fire Drill|skill|beginner|3min|athleticism
df-21|Lane Line Slides|skill|beginner|5min|defense
df-22|Backpedal Sprint Drill|skill|intermediate|6min|athleticism
df-23|Defensive Mirror Slides|skill|intermediate|6min|defense
df-24|Tip Drill|skill|intermediate|5min|athleticism
df-25|Rebound War Drill|skill|advanced|8min|defense

SPEED & AGILITY:
sa-1|Ladder Quick Feet|conditioning|beginner|5min|athleticism
sa-2|Ladder In and Outs|conditioning|beginner|5min|athleticism
sa-3|Ladder Icky Shuffle|conditioning|intermediate|5min|athleticism
sa-4|Cone Shuttle Drill|conditioning|beginner|5min|athleticism
sa-5|5-10-5 Shuttle Run|conditioning|intermediate|5min|athleticism
sa-6|Suicide Runs|conditioning|beginner|5min|athleticism
sa-7|Cone Zig-Zag Sprint|conditioning|intermediate|6min|athleticism
sa-8|Defensive Slide Sprints|conditioning|intermediate|6min|athleticism
sa-9|Backpedal Sprint Drill|conditioning|beginner|6min|athleticism
sa-10|Lateral Cone Hops|conditioning|intermediate|5min|athleticism
sa-11|Single Leg Bounds|conditioning|intermediate|5min|athleticism
sa-12|Broad Jumps|conditioning|beginner|5min|athleticism
sa-13|Sprint and Backpedal|conditioning|beginner|6min|athleticism
sa-14|Reaction Sprint Drill|conditioning|intermediate|6min|athleticism
sa-15|T Drill|conditioning|intermediate|5min|athleticism
sa-16|Box Drill|conditioning|intermediate|5min|athleticism
sa-17|Line Hops|conditioning|beginner|3min|athleticism
sa-18|Carioca Drill|conditioning|beginner|5min|athleticism
sa-19|Sprint Turn Sprint|conditioning|intermediate|5min|athleticism
sa-20|Resistance Band Sprints|conditioning|intermediate|8min|athleticism
sa-21|Partner Reaction Drill|conditioning|intermediate|6min|athleticism
sa-22|Quick Drop Step Drill|conditioning|intermediate|5min|athleticism
sa-23|Shuffle Sprint Shuffle|conditioning|intermediate|5min|athleticism
sa-24|Jump Stop Sprint Drill|conditioning|beginner|5min|athleticism
sa-25|Acceleration Sprints|conditioning|beginner|5min|athleticism

WARMUP:
wu-1|High Knees|warmup|beginner|2min|athleticism
wu-2|Butt Kicks|warmup|beginner|2min|athleticism
wu-3|Walking Lunges|warmup|beginner|3min|athleticism
wu-4|Leg Swings|warmup|beginner|2min|athleticism
wu-5|Arm Circles|warmup|beginner|2min|athleticism
wu-6|Hip Openers|warmup|beginner|3min|athleticism
wu-7|Hamstring Stretch|warmup|beginner|3min|athleticism
wu-8|Quad Stretch|warmup|beginner|2min|athleticism
wu-9|Calf Stretch|warmup|beginner|2min|athleticism
wu-10|Groin Stretch|warmup|beginner|3min|athleticism
wu-11|Ankle Mobility Drill|warmup|beginner|3min|athleticism
wu-12|Dynamic Toe Touch|warmup|beginner|2min|athleticism
wu-13|Side Lunges|warmup|beginner|3min|athleticism
wu-14|Jump Rope Warmup|warmup|beginner|5min|athleticism
wu-15|Light Form Shooting Warmup|warmup|beginner|5min|shotForm
wu-16|Jog and Backpedal|warmup|beginner|3min|athleticism
wu-17|Defensive Slides Warmup|warmup|beginner|3min|defense
wu-18|Foam Rolling|warmup|beginner|5min|athleticism
wu-19|Static Stretch Cooldown|warmup|beginner|8min|athleticism
wu-20|Deep Breathing Cooldown|warmup|beginner|3min|athleticism
wu-21|Mobility Flow|warmup|beginner|5min|athleticism
wu-22|Frankenstein Walk|warmup|beginner|2min|athleticism
wu-23|Heel Walk|warmup|beginner|2min|athleticism
wu-24|Toe Walk|warmup|beginner|2min|athleticism
wu-25|Light Layup Warmup|warmup|beginner|5min|finishing

CONDITIONING:
cd-1|Suicides|conditioning|intermediate|5min|athleticism
cd-2|17s|conditioning|advanced|5min|athleticism
cd-3|Full Court Layups Conditioning|conditioning|intermediate|8min|finishing
cd-4|Lane Line Sprints|conditioning|beginner|5min|athleticism
cd-5|Baseline Touches|conditioning|beginner|5min|athleticism
cd-6|Continuous Fast Break Drill|conditioning|intermediate|10min|finishing
cd-7|3 Minute Shooting Conditioning|conditioning|intermediate|3min|shooting
cd-8|Rebound and Putback Drill|conditioning|intermediate|5min|finishing
cd-9|Sprint Free Throw Drill|conditioning|beginner|5min|touch
cd-10|Closeout Conditioning Drill|conditioning|intermediate|8min|defense
cd-11|Defensive Slide Conditioning|conditioning|intermediate|5min|defense
cd-12|Jump Rope Conditioning|conditioning|intermediate|10min|athleticism
cd-13|Hill Sprints|conditioning|advanced|10min|athleticism
cd-14|Bleacher Runs|conditioning|advanced|10min|athleticism
cd-15|Medicine Ball Slams|conditioning|intermediate|5min|athleticism
cd-16|Burpee Sprints|conditioning|advanced|5min|athleticism
cd-17|Shuttle Runs|conditioning|beginner|5min|athleticism
cd-18|Sprint Jog Intervals|conditioning|beginner|10min|athleticism
cd-19|Full Court Dribble Sprints|conditioning|intermediate|5min|ballHandling
cd-20|Reaction Sprint Conditioning|conditioning|intermediate|6min|athleticism
cd-21|Cone Touch Conditioning|conditioning|beginner|5min|athleticism
cd-22|Push Up Sprints|conditioning|intermediate|5min|athleticism
cd-23|Plank Conditioning|conditioning|beginner|5min|athleticism
cd-24|Wall Sit Conditioning|conditioning|beginner|5min|athleticism
cd-25|Continuous Mikan Drill|conditioning|intermediate|5min|finishing

BASKETBALL IQ:
iq-1|Read and React Drill|skill|intermediate|10min|decisionMaking
iq-2|Advantage Disadvantage Drill|skill|intermediate|10min|decisionMaking
iq-3|Pick and Roll Read Drill|skill|advanced|10min|decisionMaking
iq-4|Drive and Kick Drill|skill|intermediate|8min|courtVision
iq-5|Help Defense Rotation Drill|skill|advanced|10min|defense
iq-6|Transition Decision Drill|skill|intermediate|8min|decisionMaking
iq-7|Shot Selection Drill|skill|intermediate|10min|decisionMaking
iq-8|Clock Management Drill|skill|advanced|10min|iq
iq-9|Situational Scrimmage|skill|advanced|15min|iq
iq-10|3 on 2 Continuous|skill|intermediate|10min|decisionMaking
iq-11|4 on 3 Advantage Drill|skill|intermediate|10min|courtVision
iq-12|No Dribble Scrimmage|skill|intermediate|10min|courtVision
iq-13|One Dribble Scrimmage|skill|intermediate|10min|decisionMaking
iq-14|Spacing Drill|skill|intermediate|10min|iq
iq-15|Backdoor Cut Drill|skill|intermediate|8min|iq
iq-16|Give and Go Drill|skill|beginner|8min|iq
iq-17|Closeout Decision Drill|skill|advanced|8min|decisionMaking
iq-18|Extra Pass Drill|skill|intermediate|8min|courtVision
iq-19|Skip Pass Drill|skill|intermediate|6min|courtVision
iq-20|Offensive Rebound Decision Drill|skill|intermediate|8min|decisionMaking
iq-21|End of Game Situations|skill|advanced|10min|iq
iq-22|Press Break Drill|skill|intermediate|8min|iq
iq-23|Zone Offense Drill|skill|intermediate|10min|iq
iq-24|Defensive Communication Drill|skill|intermediate|8min|defense
iq-25|Film Study Session|skill|beginner|15min|iq
iq-26|Head Up Dribble Drill|skill|beginner|6min|courtVision
iq-27|Scan and Pass Drill|skill|intermediate|8min|courtVision
iq-28|Peripheral Vision Drill|skill|intermediate|6min|courtVision
`.trim();

export default async function handler(req, res) {
  // ---------- SECURITY ----------
  const security = applySecurity(req, res, {
    rateLimit: 10,
    rateLimitWindowMs: 60 * 60 * 1000,
    maxBodySize: 512 * 1024,
  });
  if (!security.ok) return;

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

COACH X ASSESSMENT:
ALL SKILL LEVELS: ${allScores}
WEAKEST 3 SKILLS (focus most drills here): ${weakest}
STRONGEST 3 SKILLS: ${strongest}

CRITICAL: At least 60% of skill drills should target the bottom 3 skills. Match each drill's primarySkill to the weakest skills you want to attack.`;
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

  const prompt = `You are Coach X, an elite basketball trainer building a personalized weekly training plan.

PLAYER: ${position}, ${experience || 'unknown experience'}
${description ? 'DESCRIBED AS: ' + description : ''}
GOAL: ${goal || 'become a more complete player'}
WEAKNESS: ${weakness || 'overall game'}${fieldLines}${makesLine}${dribblingLine}
FREQUENCY: ${frequency}
SESSION LENGTH: ${duration}
FACILITIES: ${Array.isArray(access) ? access.join(', ') : access}${levelContext}${skillSection}

============================================================
DRILL LIBRARY — YOU MUST PICK DRILLS BY ID FROM THIS LIST.
DO NOT INVENT DRILLS. DO NOT MAKE UP NAMES.
Format: id|name|type|difficulty|duration|primarySkill
============================================================
${DRILL_INDEX}
============================================================

RULES:
1. Every drill in the plan MUST be a real drill from the library above. Reference it by drillId only (e.g. "sh-7", "bh-20", "fn-4").
2. Match drills to the player's weakest skills. If weak hand is bottom 3, use bh-20, bh-30, fn-4, fn-26.
3. Match drills to the player's level: beginner skills = mostly beginner drills, advanced = mix in advanced drills.
4. Session structure: 1 warmup drill (wu-X) first + 4-6 skill/shooting drills + 1 conditioning or cooldown drill last.
5. Total drill durations per session must roughly equal "${duration}".
6. If left hand is weak, EVERY training session must include at least one weak-hand drill (bh-9, bh-10, bh-11, bh-20, bh-24, bh-30, fn-4, fn-26).
7. Day "focus" must be SHORT (1-3 words). Examples: "Ball Handling", "Defense", "Left Hand", "Shooting", "Finishing".
8. Rest days based on "${frequency}". Rest days have isRest=true and drills=[].
9. Don't pick the exact same 6 drills every day — vary the mix while still attacking the weakest skills.
10. coachSummary.assessment: Coach X talking to the player, 2-3 sentences, referencing weaknesses by name. Don't claim to have watched film.

Return ONLY valid JSON, no markdown, no backticks:
{"weekTitle":"Week 1: Short Theme","aiInsight":"...","coachSummary":{"greeting":"...","assessment":"...","planOverview":"...","motivation":"..."},"days":[{"day":"Mon","date":"","focus":"SHORT","duration":"... min","isRest":false,"drills":[{"drillId":"sh-1","time":"5 min"}]}]}

Each drill object must ONLY have: drillId (from library) and time (e.g. "5 min"). Nothing else — the app looks up name/summary/cues/video from drillId.

Include all 7 days Mon-Sun.`;

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
            drills: Array.isArray(d.drills) ? d.drills : [],
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
