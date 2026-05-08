// ============================================================================
// coach-chat.js — Coach X chat backend
// ============================================================================
// This is the updated version that includes shot tracking context. When the
// frontend sends a message, it can also pass `shootingContext` (a string built
// by buildShootingContextString() from shotSync.ts on the client). That gets
// dropped into the system prompt so Coach X has real shooting numbers when
// the player asks about their shot.
//
// Backwards compatible — if shootingContext is not provided, behavior is
// identical to the previous version.
// ============================================================================

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

  const {
    messages,           // chat history [{ role, content }]
    profile,            // player profile object
    plan,               // current training plan
    skillLevels,        // skill scoring
    shootingContext,    // NEW: string from buildShootingContextString() on client
    recentFilm,         // optional: most recent film analysis result
  } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages required' });
  }

  // ----- Build the system prompt with all available context -----

  let systemPrompt = `You are Coach X — a basketball trainer with personality. You're talking directly to the player.

VOICE & TONE:
- Direct, honest, like a real trainer who sees you every day
- Short sentences. Don't lecture.
- Use specifics from their data. Don't speak in generalities.
- Encouraging but not cheesy. Push back when needed.
- Never break character. Never say "as an AI". You ARE Coach X.
- Don't use emojis unless the player uses one first.`;

  // Player profile
  if (profile) {
    systemPrompt += `\n\nPLAYER PROFILE:`;
    if (profile.name) systemPrompt += `\n- Name: ${profile.name}`;
    if (profile.position) systemPrompt += `\n- Position: ${profile.position}`;
    if (profile.experience) systemPrompt += `\n- Experience: ${profile.experience}`;
    if (profile.goal) systemPrompt += `\n- Goal: ${profile.goal}`;
    if (profile.weakness) systemPrompt += `\n- Stated weakness: ${profile.weakness}`;
    if (profile.goToMove) systemPrompt += `\n- Go-to move: ${profile.goToMove}`;
    if (profile.threeConfidence) systemPrompt += `\n- 3pt confidence: ${profile.threeConfidence}`;
    if (profile.freeThrow) systemPrompt += `\n- Free throw: ${profile.freeThrow}`;
    if (profile.frequency) systemPrompt += `\n- Trains ${profile.frequency}`;
  }

  // Skill levels
  if (skillLevels && Object.keys(skillLevels).length > 0) {
    const SKILL_LABELS = {
      ballHandling: 'Ball Handling', shooting: 'Shooting', shotForm: 'Shot Form',
      finishing: 'Finishing', defense: 'Defense', iq: 'Basketball IQ',
      athleticism: 'Athleticism', weakHand: 'Weak Hand', creativity: 'Creativity',
      touch: 'Touch', courtVision: 'Court Vision', decisionMaking: 'Decision Making',
    };
    const sorted = Object.entries(skillLevels).sort((a, b) => a[1] - b[1]);
    const weakest = sorted.slice(0, 3)
      .map(([k, v]) => (SKILL_LABELS[k] || k) + ' (' + v + '/10)')
      .join(', ');
    systemPrompt += `\n\nWEAKEST SKILLS: ${weakest}`;
  }

  // Current plan context
  if (plan && plan.weekTitle) {
    systemPrompt += `\n\nTHIS WEEK'S PLAN: ${plan.weekTitle}`;
    if (plan.aiInsight) systemPrompt += `\nFocus: ${plan.aiInsight}`;
  }

  // NEW: Shot tracking data
  if (shootingContext && shootingContext.trim().length > 0 && shootingContext !== 'No tracked shooting data yet.') {
    systemPrompt += `\n\nVERIFIED SHOOTING DATA (from camera-tracked sessions):\n${shootingContext}`;
    systemPrompt += `\n\nIMPORTANT: When the player asks about their shooting, reference these REAL numbers — not generic advice. They tracked this. They want to hear their actual stats.`;
  }

  // Recent film (if user analyzed a clip recently)
  if (recentFilm && recentFilm.summary) {
    systemPrompt += `\n\nMOST RECENT FILM ANALYSIS: ${recentFilm.summary}`;
    if (recentFilm.grade) systemPrompt += `\nGrade: ${recentFilm.grade}`;
  }

  systemPrompt += `\n\nKEEP RESPONSES SHORT. 1-3 sentences typical. Long answers only if the player asks something complex.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    const responseText = message.content[0].text;
    return res.status(200).json({ response: responseText });
  } catch (error) {
    console.error('Coach chat error:', error);
    return res.status(500).json({ error: 'Failed to get response from Coach X' });
  }
}
