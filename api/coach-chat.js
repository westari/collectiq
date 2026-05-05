import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRILL_NAMES = {
  'bh-1': 'Pound Dribbles', 'bh-3': 'In & Out Dribble', 'bh-4': 'Crossover Dribble',
  'bh-5': 'Between the Legs Dribble', 'bh-6': 'Behind the Back Dribble', 'bh-7': 'Figure 8 Dribble',
  'bh-8': 'Spider Dribble', 'bh-9': 'Two Ball Pound Dribble', 'bh-10': 'Two Ball Alternating Dribble',
  'bh-11': 'Two Ball Crossover', 'bh-12': 'Cone Zig-Zag Dribble', 'bh-13': 'Retreat Dribble',
  'bh-14': 'Hesitation Dribble', 'bh-16': 'Stationary Combo Dribbles', 'bh-17': 'Tennis Ball Dribble',
  'bh-18': 'Full Court Speed Dribble', 'bh-22': 'Dribble Knockout', 'bh-23': 'Tight Space Dribbling',
  'bh-24': 'Two Ball High-Low Dribble', 'bh-28': 'Counter Move Drill', 'bh-30': 'Weak Hand Combo Series',
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
  'fn-1': 'Mikan Drill', 'fn-2': 'Reverse Mikan Drill', 'fn-3': 'Power Layups',
  'fn-4': 'Weak Hand Layups', 'fn-5': 'Euro Step Finish', 'fn-6': 'Spin Move Finish',
  'fn-7': 'Floater Drill', 'fn-8': 'Runner Finish', 'fn-9': 'Contact Layups',
  'fn-10': 'Cone Layups', 'fn-11': 'Baseline Reverse Layups', 'fn-12': 'Inside Hand Finish',
  'fn-13': 'Outside Hand Finish', 'fn-14': 'Pro Hop Finish', 'fn-15': 'Hop Step Finish',
  'fn-16': 'Two Foot Finish', 'fn-17': 'One Foot Finish', 'fn-18': 'Up and Under Finish',
  'fn-19': 'Putback Finishes', 'fn-20': 'Transition Layups', 'fn-21': 'Chair Finish Drill',
  'fn-22': 'Defender Pad Finishes', 'fn-23': 'High Glass Finish', 'fn-24': 'Drop Step Finish',
  'fn-25': 'Post Move Finish', 'fn-26': 'Weak Hand Finishing Series', 'fn-27': 'Mid-Range Touch Drill',
  'df-1': 'Defensive Slide Drill', 'df-2': 'Closeout Drill', 'df-3': 'Shell Drill',
  'df-4': 'Mirror Drill', 'df-5': 'Zig-Zag Defensive Slides', 'df-6': 'Charge Drill',
  'df-7': 'Box Out Drill', 'df-8': 'Rebound and Outlet Drill', 'df-9': '1 on 1 Full Court Defense',
  'df-10': 'Deny the Wing Drill', 'df-11': 'Help Side Defense Drill', 'df-12': 'Defensive Stance Holds',
  'df-13': 'Reaction Closeouts', 'df-14': 'Ball Pressure Drill', 'df-15': 'Trap Drill',
  'df-16': 'Recover Drill', 'df-17': 'Defensive Shuffle Sprint Drill', 'df-18': 'Loose Ball Dive Drill',
  'df-19': 'Contest Without Fouling Drill', 'df-20': 'Foot Fire Drill', 'df-21': 'Lane Line Slides',
  'df-22': 'Backpedal Sprint Drill', 'df-23': 'Defensive Mirror Slides', 'df-24': 'Tip Drill',
  'df-25': 'Rebound War Drill',
};

function getDrillName(drillId) {
  return DRILL_NAMES[drillId] || drillId;
}

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, userId } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages required' });
  }

  // ============================================================
  // PULL ALL USER CONTEXT FROM SUPABASE
  // ============================================================
  let userContext = '';

  if (userId) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profile) {
        userContext += '\n=== PLAYER PROFILE ===\n';
        if (profile.position) userContext += `Position: ${profile.position}\n`;
        if (profile.experience) userContext += `Experience: ${profile.experience}\n`;
        if (profile.goal) userContext += `Goal: ${profile.goal}\n`;
        if (profile.weakness) userContext += `Stated weakness: ${profile.weakness}\n`;
        if (profile.left_hand) userContext += `Weak hand status: ${profile.left_hand}\n`;
        if (profile.go_to_move) userContext += `Go-to move: ${profile.go_to_move}\n`;
        if (profile.three_confidence) userContext += `3-point confidence: ${profile.three_confidence}\n`;
        if (profile.free_throw) userContext += `Free throw confidence: ${profile.free_throw}\n`;
        if (profile.frequency) userContext += `Training frequency: ${profile.frequency}\n`;
        if (profile.duration) userContext += `Session length: ${profile.duration}\n`;

        if (profile.skill_levels) {
          const skills = typeof profile.skill_levels === 'string'
            ? JSON.parse(profile.skill_levels)
            : profile.skill_levels;
          if (skills && Object.keys(skills).length > 0) {
            const SKILL_LABELS = {
              ballHandling: 'Ball Handling', shooting: 'Shooting', shotForm: 'Shot Form',
              finishing: 'Finishing', defense: 'Defense', iq: 'Basketball IQ',
              athleticism: 'Athleticism', weakHand: 'Weak Hand', creativity: 'Creativity',
              touch: 'Touch', courtVision: 'Court Vision', decisionMaking: 'Decision Making',
            };
            const sorted = Object.entries(skills).sort((a, b) => a[1] - b[1]);
            const weakest = sorted.slice(0, 3).map(([k, v]) => `${SKILL_LABELS[k] || k} (${v}/10)`).join(', ');
            const strongest = sorted.slice(-3).reverse().map(([k, v]) => `${SKILL_LABELS[k] || k} (${v}/10)`).join(', ');
            userContext += `\nWeakest skills: ${weakest}\n`;
            userContext += `Strongest skills: ${strongest}\n`;
          }
        }
      }

      const { data: planRow } = await supabase
        .from('plans')
        .select('plan_data')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (planRow?.plan_data) {
        const plan = typeof planRow.plan_data === 'string'
          ? JSON.parse(planRow.plan_data)
          : planRow.plan_data;

        if (plan.days && Array.isArray(plan.days)) {
          userContext += '\n=== THIS WEEK\'S PLAN ===\n';
          const today = new Date();
          const dayIndex = (today.getDay() + 6) % 7;
          const todayName = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][dayIndex];

          plan.days.forEach((day) => {
            const isToday = day.day === todayName;
            const marker = isToday ? ' (TODAY)' : '';
            if (day.isRest) {
              userContext += `${day.day}${marker}: REST\n`;
            } else {
              const drillNames = (day.drills || [])
                .map(d => getDrillName(d.drillId || d.name))
                .filter(Boolean)
                .join(', ');
              userContext += `${day.day}${marker} - ${day.focus} (${day.duration}): ${drillNames || 'No drills'}\n`;
            }
          });
        }
      }

      const { data: films } = await supabase
        .from('film_analyses')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(3);

      if (films && films.length > 0) {
        userContext += '\n=== RECENT FILM ANALYSES ===\n';
        films.forEach((f, i) => {
          const date = new Date(f.created_at).toLocaleDateString();
          userContext += `\nFilm ${i + 1} (${date}, Grade: ${f.overall_grade}):\n`;
          if (f.opening_line) userContext += `  Coach X said: "${f.opening_line}"\n`;
          if (f.summary) userContext += `  Summary: ${f.summary}\n`;
          if (f.moments && Array.isArray(f.moments)) {
            const weakMoments = f.moments.filter(m => m.type === 'weakness').slice(0, 2);
            if (weakMoments.length > 0) {
              userContext += `  Weaknesses noted: ${weakMoments.map(m => m.label).join(', ')}\n`;
            }
          }
        });
      }

      const { data: completed } = await supabase
        .from('completed_drills')
        .select('*')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })
        .limit(10);

      if (completed && completed.length > 0) {
        userContext += '\n=== RECENTLY COMPLETED DRILLS ===\n';
        completed.forEach(c => {
          const drillName = getDrillName(c.drill_id || `day ${c.day_index} drill ${c.drill_index}`);
          const date = new Date(c.completed_at).toLocaleDateString();
          userContext += `- ${drillName} (${date})\n`;
        });
      }
    } catch (err) {
      console.error('Error pulling user context:', err.message);
    }
  }

  const systemPrompt = `You are Coach X — an elite basketball trainer who knows this player personally. You're not a generic AI. You're THEIR coach. You've watched their film, designed their plan, and know their strengths and weaknesses cold.

TONE:
- Talk like a real coach. Direct, honest, no fluff.
- Use "you" not "the player." Talk TO them.
- Short sentences. Real coach energy.
- Encouraging but never fake. If something needs work, say it straight.
- Examples of how you talk:
  - "Your handle's solid but predictable. Hesitation Dribble fixes that."
  - "Today's a handle day. Don't skip the weak hand work."
  - "I saw you in your last film. Your weak hand is killing you. Let's fix it."
  - "Real talk — you've done Pound Dribbles 4x this week. Time to progress."

RULES:
- NEVER pretend to be Claude or any other AI. You are Coach X.
- NEVER recommend drills not in the player's plan or library. If you mention a drill, use exact names.
- NEVER give generic basketball advice. Always tie advice to THIS player's profile, plan, or recent film.
- If the player asks something off-topic, keep it brief and bring it back to basketball.
- If you don't have context for something, say so directly. Don't make stuff up.
- Keep responses to 2-4 sentences unless they ask for detail. Coaches don't lecture.

CRITICAL: Below is everything you know about this player. Reference it when relevant. Don't dump it all on them — pull what's relevant to their question.

${userContext || '(No player data available — keep responses general but still in Coach X voice.)'}
`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: systemPrompt,
      messages: messages,
    });

    const responseText = message.content[0]?.text || '';

    return res.status(200).json({
      message: responseText,
    });
  } catch (error) {
    console.error('Coach X chat error:', error.message || error);
    return res.status(500).json({ error: 'Coach X is taking a break. Try again in a sec.' });
  }
}
