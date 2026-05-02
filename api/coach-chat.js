import Anthropic from "@anthropic-ai/sdk";
import { createClient } from '@supabase/supabase-js';
import { applySecurity } from './_middleware.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const config = {
  maxDuration: 60,
};

// ============================================================
// DRILL NAME LOOKUP — synced with expo/constants/drillLibrary.ts
// Just id → name. Used to translate plan drillIds back to readable names.
// ============================================================
const DRILL_NAMES = {
  // Ball Handling
  'bh-1': 'Pound Dribbles', 'bh-2': 'Alternating Pound Dribbles', 'bh-3': 'In & Out Dribble',
  'bh-4': 'Crossover Dribble', 'bh-5': 'Between the Legs Dribble', 'bh-6': 'Behind the Back Dribble',
  'bh-7': 'Figure 8 Dribble', 'bh-8': 'Spider Dribble', 'bh-9': 'Two Ball Pound Dribble',
  'bh-10': 'Two Ball Alternating Dribble', 'bh-11': 'Two Ball Crossover', 'bh-12': 'Cone Zig-Zag Dribble',
  'bh-13': 'Retreat Dribble', 'bh-14': 'Hesitation Dribble', 'bh-15': 'Speed Dribble',
  'bh-16': 'Stationary Combo Dribbles', 'bh-17': 'Tennis Ball Dribble', 'bh-18': 'Full Court Speed Dribble',
  'bh-19': 'Chair Change of Direction Drill', 'bh-20': 'Weak Hand Only Dribble', 'bh-21': 'Circle Dribble Drill',
  'bh-22': 'Dribble Knockout', 'bh-23': 'Tight Space Dribbling', 'bh-24': 'Two Ball High-Low Dribble',
  'bh-25': 'Attack Cone Dribble', 'bh-26': 'Move Chaining Drill', 'bh-27': 'Random Move Drill',
  'bh-28': 'Counter Move Drill', 'bh-29': 'Live Ball Improvisation Drill', 'bh-30': 'Weak Hand Combo Series',
  // Shooting
  'sh-1': 'Form Shooting', 'sh-2': 'One Hand Form Shooting', 'sh-3': 'BEEF Shooting Drill',
  'sh-4': 'Around the World', 'sh-5': 'Spot Shooting', 'sh-6': 'Catch and Shoot',
  'sh-7': 'Off the Dribble Pull Up', 'sh-8': '5 Spot Shooting', 'sh-9': 'Mikan Shooting Drill',
  'sh-10': 'Elbow Shooting', 'sh-11': 'Corner Shooting', 'sh-12': 'Wing Shooting',
  'sh-13': 'Free Throw Routine', 'sh-14': 'Chair Curl Shooting', 'sh-15': 'Fadeaway Shooting',
  'sh-16': 'Step Back Shooting', 'sh-17': 'Pump Fake One Dribble Shot', 'sh-18': 'Transition Pull Up',
  'sh-19': 'Relocation Shooting', 'sh-20': 'Partner Pass Shooting', 'sh-21': 'Closeout Shooting',
  'sh-22': 'Quick Release Shooting', 'sh-23': 'Shooting Off Screens', 'sh-24': '3 Point Spot Shooting',
  'sh-25': '100 Makes Shooting Drill', 'sh-26': 'Elbow Alignment Drill', 'sh-27': 'Guide Hand Removal Drill',
  'sh-28': 'Dip Fix Drill',
  // Finishing
  'fn-1': 'Mikan Drill', 'fn-2': 'Reverse Mikan Drill', 'fn-3': 'Power Layups',
  'fn-4': 'Weak Hand Layups', 'fn-5': 'Euro Step Finish', 'fn-6': 'Spin Move Finish',
  'fn-7': 'Floater Drill', 'fn-8': 'Runner Finish', 'fn-9': 'Contact Layups',
  'fn-10': 'Cone Layups', 'fn-11': 'Baseline Reverse Layups', 'fn-12': 'Inside Hand Finish',
  'fn-13': 'Outside Hand Finish', 'fn-14': 'Pro Hop Finish', 'fn-15': 'Hop Step Finish',
  'fn-16': 'Two Foot Finish', 'fn-17': 'One Foot Finish', 'fn-18': 'Up and Under Finish',
  'fn-19': 'Putback Finishes', 'fn-20': 'Transition Layups', 'fn-21': 'Chair Finish Drill',
  'fn-22': 'Defender Pad Finishes', 'fn-23': 'High Glass Finish', 'fn-24': 'Drop Step Finish',
  'fn-25': 'Post Move Finish', 'fn-26': 'Weak Hand Finishing Series', 'fn-27': 'Mid-Range Touch Drill',
  // Defense
  'df-1': 'Defensive Slide Drill', 'df-2': 'Closeout Drill', 'df-3': 'Shell Drill',
  'df-4': 'Mirror Drill', 'df-5': 'Zig-Zag Defensive Slides', 'df-6': 'Charge Drill',
  'df-7': 'Box Out Drill', 'df-8': 'Rebound and Outlet Drill', 'df-9': '1 on 1 Full Court Defense',
  'df-10': 'Deny the Wing Drill', 'df-11': 'Help Side Defense Drill', 'df-12': 'Defensive Stance Holds',
  'df-13': 'Reaction Closeouts', 'df-14': 'Ball Pressure Drill', 'df-15': 'Trap Drill',
  'df-16': 'Recover Drill', 'df-17': 'Defensive Shuffle Sprint Drill', 'df-18': 'Loose Ball Dive Drill',
  'df-19': 'Contest Without Fouling Drill', 'df-20': 'Foot Fire Drill', 'df-21': 'Lane Line Slides',
  'df-22': 'Backpedal Sprint Drill', 'df-23': 'Defensive Mirror Slides', 'df-24': 'Tip Drill',
  'df-25': 'Rebound War Drill',
  // Speed & Agility
  'sa-1': 'Ladder Quick Feet', 'sa-2': 'Ladder In and Outs', 'sa-3': 'Ladder Icky Shuffle',
  'sa-4': 'Cone Shuttle Drill', 'sa-5': '5-10-5 Shuttle Run', 'sa-6': 'Suicide Runs',
  'sa-7': 'Cone Zig-Zag Sprint', 'sa-8': 'Defensive Slide Sprints', 'sa-9': 'Backpedal Sprint Drill',
  'sa-10': 'Lateral Cone Hops', 'sa-11': 'Single Leg Bounds', 'sa-12': 'Broad Jumps',
  'sa-13': 'Sprint and Backpedal', 'sa-14': 'Reaction Sprint Drill', 'sa-15': 'T Drill',
  'sa-16': 'Box Drill', 'sa-17': 'Line Hops', 'sa-18': 'Carioca Drill',
  'sa-19': 'Sprint Turn Sprint', 'sa-20': 'Resistance Band Sprints', 'sa-21': 'Partner Reaction Drill',
  'sa-22': 'Quick Drop Step Drill', 'sa-23': 'Shuffle Sprint Shuffle', 'sa-24': 'Jump Stop Sprint Drill',
  'sa-25': 'Acceleration Sprints',
  // Warmup
  'wu-1': 'High Knees', 'wu-2': 'Butt Kicks', 'wu-3': 'Walking Lunges', 'wu-4': 'Leg Swings',
  'wu-5': 'Arm Circles', 'wu-6': 'Hip Openers', 'wu-7': 'Hamstring Stretch', 'wu-8': 'Quad Stretch',
  'wu-9': 'Calf Stretch', 'wu-10': 'Groin Stretch', 'wu-11': 'Ankle Mobility Drill',
  'wu-12': 'Dynamic Toe Touch', 'wu-13': 'Side Lunges', 'wu-14': 'Jump Rope Warmup',
  'wu-15': 'Light Form Shooting Warmup', 'wu-16': 'Jog and Backpedal', 'wu-17': 'Defensive Slides Warmup',
  'wu-18': 'Foam Rolling', 'wu-19': 'Static Stretch Cooldown', 'wu-20': 'Deep Breathing Cooldown',
  'wu-21': 'Mobility Flow', 'wu-22': 'Frankenstein Walk', 'wu-23': 'Heel Walk',
  'wu-24': 'Toe Walk', 'wu-25': 'Light Layup Warmup',
  // Conditioning
  'cd-1': 'Suicides', 'cd-2': '17s', 'cd-3': 'Full Court Layups Conditioning',
  'cd-4': 'Lane Line Sprints', 'cd-5': 'Baseline Touches', 'cd-6': 'Continuous Fast Break Drill',
  'cd-7': '3 Minute Shooting Conditioning', 'cd-8': 'Rebound and Putback Drill',
  'cd-9': 'Sprint Free Throw Drill', 'cd-10': 'Closeout Conditioning Drill',
  'cd-11': 'Defensive Slide Conditioning', 'cd-12': 'Jump Rope Conditioning',
  'cd-13': 'Hill Sprints', 'cd-14': 'Bleacher Runs', 'cd-15': 'Medicine Ball Slams',
  'cd-16': 'Burpee Sprints', 'cd-17': 'Shuttle Runs', 'cd-18': 'Sprint Jog Intervals',
  'cd-19': 'Full Court Dribble Sprints', 'cd-20': 'Reaction Sprint Conditioning',
  'cd-21': 'Cone Touch Conditioning', 'cd-22': 'Push Up Sprints', 'cd-23': 'Plank Conditioning',
  'cd-24': 'Wall Sit Conditioning', 'cd-25': 'Continuous Mikan Drill',
  // Basketball IQ
  'iq-1': 'Read and React Drill', 'iq-2': 'Advantage Disadvantage Drill', 'iq-3': 'Pick and Roll Read Drill',
  'iq-4': 'Drive and Kick Drill', 'iq-5': 'Help Defense Rotation Drill', 'iq-6': 'Transition Decision Drill',
  'iq-7': 'Shot Selection Drill', 'iq-8': 'Clock Management Drill', 'iq-9': 'Situational Scrimmage',
  'iq-10': '3 on 2 Continuous', 'iq-11': '4 on 3 Advantage Drill', 'iq-12': 'No Dribble Scrimmage',
  'iq-13': 'One Dribble Scrimmage', 'iq-14': 'Spacing Drill', 'iq-15': 'Backdoor Cut Drill',
  'iq-16': 'Give and Go Drill', 'iq-17': 'Closeout Decision Drill', 'iq-18': 'Extra Pass Drill',
  'iq-19': 'Skip Pass Drill', 'iq-20': 'Offensive Rebound Decision Drill', 'iq-21': 'End of Game Situations',
  'iq-22': 'Press Break Drill', 'iq-23': 'Zone Offense Drill', 'iq-24': 'Defensive Communication Drill',
  'iq-25': 'Film Study Session', 'iq-26': 'Head Up Dribble Drill', 'iq-27': 'Scan and Pass Drill',
  'iq-28': 'Peripheral Vision Drill',
};

const SKILL_LABELS = {
  ballHandling: 'Ball Handling', shooting: 'Shooting', shotForm: 'Shot Form',
  finishing: 'Finishing', defense: 'Defense', iq: 'Basketball IQ',
  athleticism: 'Athleticism', weakHand: 'Weak Hand', creativity: 'Creativity',
  touch: 'Touch', courtVision: 'Court Vision', decisionMaking: 'Decision Making',
};

export default async function handler(req, res) {
  const security = applySecurity(req, res, {
    rateLimit: 60,
    rateLimitWindowMs: 60 * 60 * 1000,
    maxBodySize: 64 * 1024,
  });
  if (!security.ok) return;

  const { message, history } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Missing message' });

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  let userId = null;
  let memoryContext = '';
  let planContext = '';

  try {
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !userData?.user) {
      return res.status(401).json({ error: 'Invalid auth token' });
    }
    userId = userData.user.id;

    // Pull all memory in parallel
    const [skillRes, sessionsRes, drillsRes, planRes] = await Promise.all([
      supabaseAuth.from('skill_state').select('*').eq('user_id', userId).maybeSingle(),
      supabaseAuth.from('sessions').select('*').eq('user_id', userId)
        .order('created_at', { ascending: false }).limit(3),
      supabaseAuth.from('drill_results').select('*').eq('user_id', userId)
        .order('created_at', { ascending: false }).limit(10),
      supabaseAuth.from('plans').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    if (skillRes.data) {
      const skills = skillRes.data;
      const entries = Object.keys(SKILL_LABELS)
        .filter(k => skills[k] != null)
        .map(k => `${SKILL_LABELS[k]}: ${skills[k]}/10`)
        .join(', ');
      if (entries) memoryContext += `\nCURRENT SKILL LEVELS: ${entries}`;
    }

    if (sessionsRes.data && sessionsRes.data.length > 0) {
      const sessionLines = sessionsRes.data.map(s => {
        const date = s.created_at ? new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        return `- ${date}: ${s.focus || 'session'} (${s.duration_minutes || '?'} min, ${s.drills_completed || 0} drills done)`;
      }).join('\n');
      memoryContext += `\nRECENT SESSIONS:\n${sessionLines}`;
    }

    if (drillsRes.data && drillsRes.data.length > 0) {
      const drillLines = drillsRes.data.map(d => {
        const drillName = DRILL_NAMES[d.drill_id] || d.drill_id || 'unknown drill';
        const date = d.created_at ? new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        return `- ${date}: ${drillName}${d.notes ? ` (${d.notes})` : ''}`;
      }).join('\n');
      memoryContext += `\nRECENT DRILL HISTORY:\n${drillLines}`;
    }

    // Build current week plan with real drill names
    if (planRes.data?.plan_data) {
      const plan = planRes.data.plan_data;
      if (Array.isArray(plan.days)) {
        const planLines = plan.days.map(d => {
          if (d.isRest) return `- ${d.day}: REST`;
          const drillNames = (d.drills || [])
            .map(dr => DRILL_NAMES[dr.drillId] || dr.drillId || dr.name)
            .filter(Boolean)
            .join(', ');
          return `- ${d.day} (${d.focus}, ${d.duration}): ${drillNames || 'no drills'}`;
        }).join('\n');
        planContext = `\nTHIS WEEK'S PLAN (${plan.weekTitle || 'Week 1'}):\n${planLines}`;
      }
    }
  } catch (e) {
    console.error('Memory fetch failed:', e);
  }

  const systemPrompt = `You are Coach X, an elite basketball trainer talking directly to a young basketball player. You know this player well and have been coaching them.

YOUR PERSONALITY:
- Direct, confident, no fluff
- Real-coach tone (think AAU coach, not life coach)
- Short responses unless they ask for detail
- You reference what they've done, their weaknesses, their plan — by NAME
- Never make up numbers, drills, or facts about the player
- If they ask about a drill, refer to it by its actual name from their plan

CRITICAL RULES:
1. NEVER make up drill names, sessions, or stats. Only reference what's in your memory below.
2. NEVER claim you watched their film unless their memory shows film analysis happened.
3. Keep responses short — 2-4 sentences usually. Long only if they ask for a breakdown.
4. Talk like a real human coach, not a chatbot.
${memoryContext ? `\nWHAT YOU KNOW ABOUT THIS PLAYER:${memoryContext}` : '\nThis is a new player — you don\'t have history with them yet.'}
${planContext}

Now respond to their message.`;

  try {
    const messages = [];
    if (Array.isArray(history)) {
      for (const m of history.slice(-10)) {
        if (m.role && m.content) messages.push({ role: m.role, content: m.content });
      }
    }
    messages.push({ role: 'user', content: message });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: systemPrompt,
      messages,
    });

    const text = response.content[0].text;
    return res.status(200).json({ message: text });
  } catch (e) {
    console.error('Coach X chat error:', e);
    return res.status(500).json({ error: 'Coach X is having trouble right now.' });
  }
}
