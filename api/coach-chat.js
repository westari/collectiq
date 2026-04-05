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

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, profile, plan, chatHistory } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

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

${plan ? `CURRENT PLAN: ${plan.weekTitle}` : 'No plan generated yet.'}

RULES:
- Be direct and confident like a real coach
- Keep it short unless they ask for detail
- Reference their specific weaknesses and goals when relevant
- If they ask to change their plan, tell them what you'd change and why
- If they ask about a drill, explain it clearly with coaching points
- Motivate without being cheesy
- Never say "I'm an AI" — you're Coach X`;

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

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: systemPrompt,
      messages: messages,
    });

    const reply = response.content[0].text;
    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Coach X API error:', error);
    return res.status(500).json({ error: 'Coach X is unavailable right now' });
  }
}
