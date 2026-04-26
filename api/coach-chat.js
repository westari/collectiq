import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Service-role Supabase client (bypasses RLS — we manually verify the user JWT first)
// REQUIRED Vercel env vars:
//   SUPABASE_URL              — your Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY — service role key from Supabase dashboard (NOT the anon key)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export const config = {
  maxDuration: 30,
};

// ============================================================
// SKILL LABELS (for human-readable memory in the prompt)
// ============================================================
const SKILL_LABELS = {
  ballHandling: 'Ball Handling',
  shooting: 'Shooting',
  shotForm: 'Shot Form',
  finishing: 'Finishing',
  weakHand: 'Weak Hand',
  defense: 'Defense',
  iq: 'Basketball IQ',
  athleticism: 'Athleticism',
  creativity: 'Creativity',
  touch: 'Touch',
  courtVision: 'Court Vision',
  decisionMaking: 'Decision Making',
};

// ============================================================
// MEMORY FETCH
// Pulls the last few sessions, current skill state, recent drill results.
// Returns a formatted string ready to drop into the system prompt.
// ============================================================
async function buildMemoryContext(userId) {
  try {
    // Run all 3 queries in parallel for speed
    const [sessionsRes, skillsRes, drillsRes] = await Promise.all([
      supabaseAdmin
        .from('sessions')
        .select('date, day_index, completed_drills_count, duration_minutes, overall_feedback, skills_worked')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(3),
      supabaseAdmin
        .from('skill_state')
        .select('skill_category, current_level, freshness_pct, last_trained_date, recent_trend, confidence, total_sessions_worked')
        .eq('user_id', userId),
      supabaseAdmin
        .from('drill_results')
        .select('drill_id, primary_skill, date, user_feedback, outcome_value, outcome_target')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(10),
    ]);

    const sessions = sessionsRes.data || [];
    const skills = skillsRes.data || [];
    const drills = drillsRes.data || [];

    const hasAnyData = sessions.length > 0 || skills.length > 0 || drills.length > 0;
    if (!hasAnyData) {
      return null; // brand new user, no memory yet
    }

    let memory = '\n\nCOACH X MEMORY (real data from this player\'s training history):\n';

    // ---------- Recent sessions ----------
    if (sessions.length > 0) {
      memory += '\nRECENT SESSIONS:\n';
      sessions.forEach(s => {
        const skillsList = Array.isArray(s.skills_worked) ? s.skills_worked.join(', ') : 'mixed';
        const feedbackTxt = s.overall_feedback ? ` (felt ${s.overall_feedback.replace('_', ' ')})` : '';
        memory += `- ${s.date}: completed ${s.completed_drills_count} drills, ${s.duration_minutes || '?'} min, worked on ${skillsList}${feedbackTxt}\n`;
      });
    }

    // ---------- Current skill levels ----------
    if (skills.length > 0) {
      // Sort weakest first so the weakness is top-of-mind for the model
      const sortedSkills = [...skills].sort((a, b) => Number(a.current_level) - Number(b.current_level));

      memory += '\nCURRENT SKILL LEVELS (1-10 scale, with confidence):\n';
      sortedSkills.forEach(s => {
        const label = SKILL_LABELS[s.skill_category] || s.skill_category;
        const level = Number(s.current_level).toFixed(1);
        const trend = s.recent_trend && s.recent_trend !== 'flat' ? ` (${s.recent_trend})` : '';
        const conf = s.confidence ? ` [${s.confidence} confidence, ${s.total_sessions_worked || 0} sessions]` : '';
        const fresh = s.freshness_pct != null ? ` freshness ${Math.round(s.freshness_pct)}%` : '';
        memory += `- ${label}: ${level}/10${trend}${conf}${fresh}\n`;
      });

      // Highlight the weakest 2 skills explicitly
      const weakest = sortedSkills.slice(0, 2);
      if (weakest.length > 0) {
        const w = weakest.map(s => SKILL_LABELS[s.skill_category] || s.skill_category).join(' and ');
        memory += `\nWEAKEST AREAS RIGHT NOW: ${w} — these are the priorities.\n`;
      }
    }

    // ---------- Recent drill struggles ----------
    if (drills.length > 0) {
      const struggles = drills.filter(d => d.user_feedback === 'too_hard');
      const easyOnes = drills.filter(d => d.user_feedback === 'too_easy');

      if (struggles.length > 0) {
        memory += '\nRECENTLY STRUGGLED WITH:\n';
        struggles.slice(0, 5).forEach(d => {
          const label = SKILL_LABELS[d.primary_skill] || d.primary_skill;
          memory += `- ${d.drill_id} (${label}) on ${d.date}\n`;
        });
      }

      if (easyOnes.length > 0) {
        memory += '\nFOUND EASY (could push harder):\n';
        easyOnes.slice(0, 3).forEach(d => {
          const label = SKILL_LABELS[d.primary_skill] || d.primary_skill;
          memory += `- ${d.drill_id} (${label}) on ${d.date}\n`;
        });
      }
    }

    return memory;
  } catch (e) {
    console.error('buildMemoryContext failed:', e);
    return null; // don't break chat if memory fetch fails
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, profile, plan, chatHistory } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // ---------- AUTH: verify JWT and get user ID ----------
  // The app sends "Authorization: Bearer <supabase JWT>" in the request header.
  // We use Supabase admin client to verify the token and extract the user.
  let userId = null;
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (!authErr && userData?.user) {
        userId = userData.user.id;
      }
    }
  } catch (e) {
    console.error('Auth check failed:', e);
    // Continue — Coach X will work without memory, just less smart
  }

  // ---------- BUILD MEMORY CONTEXT ----------
  let memoryContext = null;
  if (userId) {
    memoryContext = await buildMemoryContext(userId);
  }

  // ---------- BUILD SYSTEM PROMPT ----------
  const systemPrompt = `You are Coach X, an elite AI basketball trainer inside the ATHLT app. You speak like a real coach — direct, confident, motivating, and knowledgeable. Keep responses SHORT (2-4 sentences max unless they ask for detail). Use a coaching tone — not corporate, not robotic.

PLAYER PROFILE:
${profile ? `- Position: ${profile.position}
- Experience: ${profile.experience}
- Goal: ${profile.goal}
- Weakness: ${profile.weakness}
- Left hand: ${profile.leftHand || 'unknown'}
- Under pressure: ${profile.pressure || 'unknown'}
- Go-to move: ${profile.goToMove || 'unknown'}
- Three-point confidence: ${profile.threeConfidence || 'unknown'}
- Free throw: ${profile.freeThrow || 'unknown'}
- Training frequency: ${profile.frequency}
- Session duration: ${profile.duration}` : 'No profile available yet.'}
${plan ? `\nCURRENT PLAN: ${plan.weekTitle}` : '\nNo plan generated yet.'}${memoryContext || ''}

RULES:
- Be direct and confident like a real coach
- Keep it short unless they ask for detail
- ALWAYS reference specific data from MEMORY when relevant — drill names, dates, skill scores, what they struggled with. Never give generic advice when you have real data on this player.
- Open conversations with a real observation from their data when appropriate (e.g., "Your weak hand dropped to 4.2 last session — that's the priority")
- If they ask to change their plan, tell them what you'd change and why, with specific reasons from their data
- If they ask about a drill, explain it clearly with coaching points
- Motivate without being cheesy
- Never say "I'm an AI" — you're Coach X
- Never make up numbers or sessions that aren't in the memory context above`;

  // ---------- BUILD MESSAGES ----------
  const messages = [];

  if (chatHistory && chatHistory.length > 0) {
    chatHistory.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    });
  }

  messages.push({
    role: 'user',
    content: message,
  });

  // ---------- CALL CLAUDE ----------
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: systemPrompt,
      messages: messages,
    });
    const reply = response.content[0].text;
    return res.status(200).json({
      reply,
      hasMemory: !!memoryContext, // app can use this to show "memory active" indicator if it wants
    });
  } catch (error) {
    console.error('Coach X API error:', error);
    return res.status(500).json({ error: 'Coach X is unavailable right now' });
  }
}
