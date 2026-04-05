import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sport, position, experience, goal, weakness, driving, leftHand, pressure, goToMove, threeConfidence, freeThrow, frequency, duration, access } = req.body;

  if (!sport || !position || !experience || !goal || !weakness || !frequency || !duration || !access) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const prompt = `You are an elite basketball skills trainer who has coached thousands of youth and high school players. You build personalized weekly training plans that are specific, actionable, and tailored to each player.

PLAYER PROFILE:
- Sport: ${sport}
- Position: ${position}
- Experience level: ${experience}
- Primary goal: ${goal}
- Biggest weakness: ${weakness}
- When they drive to the basket: ${driving || 'not specified'}
- Left hand ability: ${leftHand || 'not specified'}
- Under pressure: ${pressure || 'not specified'}
- Go-to move: ${goToMove || 'not specified'}
- Three-point confidence: ${threeConfidence || 'not specified'}
- Free throw percentage: ${freeThrow || 'not specified'}
- Training frequency: ${frequency}
- Preferred session duration: ${duration}
- Available facilities: ${Array.isArray(access) ? access.join(', ') : access}

BUILD A 7-DAY TRAINING PLAN for this player's first week.

CRITICAL RULES — FOLLOW EVERY SINGLE ONE:

SESSION DURATION: The player selected "${duration}" as their session length. Every training day MUST have drills that add up to EXACTLY that time range. If they said "60-90 minutes", each session should be 60-90 minutes of drills. Do NOT give a 45-minute plan when they asked for 60-90 minutes.

WEAKNESS FOCUS: The player said their biggest weakness is "${weakness}". At LEAST 60% of all skill drills across the entire week MUST directly target "${weakness}". If their weakness is "Finishing at the rim", most drills should be finishing drills. If "Ball handling", most should be dribbling drills. MATCH THE DRILLS TO THE WEAKNESS.

LEFT HAND: The player described their left hand as "${leftHand || 'not specified'}". If their left hand is weak or they avoid it, you MUST include left-hand-specific drills in EVERY training day. Examples: "Left hand only dribbling", "Left hand layup series", "Left hand finishing". This is critical — weak hand development should be woven into every session.

PLAY STYLE ADJUSTMENTS:
- Driving tendency: "${driving || 'not specified'}" — if they get blocked or lose the ball, add finishing and ball security drills.
- Under pressure: "${pressure || 'not specified'}" — if they struggle or turn it over, add pressure handling and tight space dribbling.
- Go-to move: "${goToMove || 'not specified'}" — build counter moves off their go-to. If they don't have one, help them develop one.
- Three-point confidence: "${threeConfidence || 'not specified'}" — if low, include form shooting. If high, add off-dribble and contested threes.
- Free throw: "${freeThrow || 'not specified'}" — if below 60%, include free throw routine in every session.

OTHER RULES:
- Only include drills that work with their available facilities
- Tailor drill complexity to their experience level (${experience})
- Include rest days based on their frequency (${frequency})
- Each training day should have 6-10 drills that flow logically (warmup first, skill work in the middle, conditioning at the end)
- Each drill needs: name, duration in minutes, type (warmup/skill/shooting/conditioning), and a detailed 2-3 sentence description
- Name training days after what the player is actually working on (e.g. "Left Hand Finishing" not just "Skills Day")
- Make drills position-specific for a ${position}

Respond ONLY in this exact JSON format with no other text, no markdown, no code fences:
{
  "weekTitle": "Week 1: [descriptive title based on their weakness and goal]",
  "aiInsight": "[2-3 sentences explaining why this plan is structured this way for this player specifically.]",
  "coachSummary": {
    "greeting": "[1 sentence greeting them by position, e.g. 'Alright, let's get to work.']",
    "assessment": "[2-3 sentences summarizing what you see based on their answers — their strengths, weaknesses, and what's holding them back. Be specific and reference their actual answers.]",
    "planOverview": "[2-3 sentences explaining what this week's plan focuses on and why. Reference specific drills or skills they'll work on.]",
    "motivation": "[1 sentence motivational closer, e.g. 'Stay consistent and you'll see results by week 3.']"
  },
  "days": [
    {
      "day": "Mon",
      "date": "",
      "focus": "[session focus area - be specific, e.g. 'Left Hand Finishing' not just 'Finishing']",
      "duration": "[total minutes] min",
      "isRest": false,
      "drills": [
        {
          "name": "[specific drill name]",
          "time": "[minutes] min",
          "type": "warmup|skill|shooting|conditioning",
          "detail": "[2-3 sentence description of exactly what to do, including reps, sets, and specific instructions]"
        }
      ]
    }
  ]
}

For rest days, set isRest to true, drills to an empty array, and duration to "—".
Make sure every day of the week (Mon through Sun) is included.
Do NOT wrap the response in markdown code fences or add any text outside the JSON.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = message.content[0].text;

    let plan;
    try {
      const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        plan = JSON.parse(jsonMatch[0]);
      } else {
        plan = JSON.parse(responseText);
      }
    } catch (parseError) {
      console.error('Failed to parse Claude response:', responseText);
      return res.status(500).json({ error: 'Failed to parse training plan', raw: responseText });
    }

    return res.status(200).json(plan);
  } catch (error) {
    console.error('Claude API error:', error);
    return res.status(500).json({ error: 'Failed to generate training plan' });
  }
}
