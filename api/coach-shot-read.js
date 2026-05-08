// ============================================================================
// coach-shot-read.js — Coach X's postgame read on a tracked shooting session
// ============================================================================
// New endpoint. Called from shot-results.tsx after a session ends.
// Takes the session stats and returns a 2-3 sentence read from Coach X
// that's saved back to the session and shown to the player.
//
// Drop into: api/coach-shot-read.js in the collectiq repo
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    sessionId,
    drillName,
    totalShots,
    makes,
    fgPct,
    zoneStats,    // [{ zone, attempts, makes, pct }]
    bestZone,
    worstZone,
    streak,       // optional best streak
    formNotes,    // optional: { avgReleaseAngle, avgArcHeight }
  } = req.body;

  if (!sessionId || totalShots === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // ----- Build the read prompt -----

  let zoneSummary = '';
  if (zoneStats && Array.isArray(zoneStats) && zoneStats.length > 0) {
    zoneSummary = '\nBY ZONE:\n' + zoneStats
      .filter(z => z.attempts >= 3)
      .sort((a, b) => b.pct - a.pct)
      .map(z => `  ${z.zone}: ${z.makes}/${z.attempts} (${Math.round(z.pct)}%)`)
      .join('\n');
  }

  let formStr = '';
  if (formNotes) {
    if (formNotes.avgReleaseAngle) {
      formStr += `\nAvg release angle: ${formNotes.avgReleaseAngle.toFixed(0)}°`;
    }
    if (formNotes.avgArcHeight) {
      formStr += `\nAvg arc: ${formNotes.avgArcHeight.toFixed(2)}`;
    }
  }

  const prompt = `You are Coach X, a real basketball trainer. The player just finished a tracked shooting session. Give them your read — like a trainer would after watching them shoot for 20 minutes.

SESSION:
${drillName ? `Drill: ${drillName}` : ''}
Total: ${makes}/${totalShots} (${Math.round(fgPct)}%)${streak ? `\nBest streak: ${streak} in a row` : ''}${zoneSummary}${formStr}

YOUR READ:
- 2-3 sentences max
- Reference at least one specific number
- If they had a strong zone, name it. If a weak one, name it
- Direct and honest. Not overly hyped.
- Sound like a real trainer who just watched them, not an app
- Don't be cheesy ("keep grinding!", "you got this!" etc — never)
- End with one specific actionable note OR a clear takeaway

Respond with ONLY the read text. No JSON, no preamble, no quotes around it. Just the read itself.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    let read = message.content[0].text.trim();

    // Strip any leading/trailing quotes the model might add
    if (read.startsWith('"') && read.endsWith('"')) {
      read = read.slice(1, -1);
    }

    return res.status(200).json({ read });
  } catch (error) {
    console.error('Coach shot read error:', error);
    return res.status(500).json({ error: 'Failed to generate read' });
  }
}
