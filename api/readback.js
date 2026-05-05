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
    sport, position, experience, age, height, weight,
    goal, weakness, driving, leftHand, pressure,
    goToMove, threeConfidence, freeThrow,
    frequency, duration, access,
  } = req.body;

  const prompt = `You are Coach X, a real high school / AAU basketball trainer. A player just finished onboarding and you're about to play back what you heard so they feel listened to.

Here is everything they told you:
- Position: ${position || 'unknown'}
- Age: ${age || 'unknown'}
- Height: ${height || 'unknown'}
- Weight: ${weight || 'unknown'}
- Experience: ${experience || 'unknown'}
- Main goal: ${goal || 'unknown'}
- Stated weakness: ${weakness || 'unknown'}
- Driving to the basket: ${driving || 'not specified'}
- Left hand: ${leftHand || 'not specified'}
- Under pressure: ${pressure || 'not specified'}
- Go-to move: ${goToMove || 'not specified'}
- Three-point confidence: ${threeConfidence || 'not specified'}
- Free throw %: ${freeThrow || 'not specified'}
- Training frequency: ${frequency || 'unknown'}
- Session length: ${duration || 'unknown'}

Your job: write 2-4 sentences in your real-coach voice that:
1. Plays back the most important details (age, position, experience) so they feel heard
2. Calls out any TENSION or CONTRADICTION you noticed in what they said. Examples:
   - They said weakness is shooting BUT they also said they avoid their left hand and lose the ball under pressure -> their HANDLE is the real issue
   - They said weakness is defense BUT they also said they don't shoot threes and miss free throws -> shooting needs work too
   - They said they want to be a scorer BUT free throw % is below 40% -> free throws are the missing piece
3. End with "Sound right?" or similar - asking for confirmation

Then separately, suggest the BEST starting focus for them. Pick ONE from this exact list:
- Ball handling
- Shooting
- Defense
- Finishing at the rim
- Speed & agility
- Basketball IQ

CRITICAL VOICE RULES:
- Real coach voice. Direct. Confident. NOT corporate, NOT AI-sounding.
- Short sentences. No hedging.
- DO NOT just repeat what they said. READ them - find the gap between what they said and what they actually need.
- Talk to them, not about them ("you told me", not "the player said")
- No motivational fluff like "let's get to work" - just the read.

Return ONLY valid JSON, no markdown, no backticks:
{"readback":"Your 2-4 sentence read of the player ending with a confirmation question.","suggestedFocus":"One option from the list above"}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].text;
    let result;
    try {
      const start = responseText.indexOf('{');
      const end = responseText.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('No JSON object found');
      const jsonString = responseText.substring(start, end + 1);
      result = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Parse error:', responseText.substring(0, 200));
      return res.status(500).json({ error: 'Failed to parse readback' });
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error('Claude API error:', error);
    return res.status(500).json({ error: 'Failed to generate readback' });
  }
}
