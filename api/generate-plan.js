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

  const { sport, position, experience, goal, weakness, frequency, duration, access } = req.body;

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
- Training frequency: ${frequency}
- Preferred session duration: ${duration}
- Available facilities: ${Array.isArray(access) ? access.join(', ') : access}

BUILD A 7-DAY TRAINING PLAN for this player's first week.

RULES:
- CRITICAL: The player said their biggest weakness is "${weakness}". At LEAST 60% of all skill drills across the entire week MUST directly target "${weakness}". If their weakness is "Finishing at the rim", most drills should be finishing drills (Mikan, euro steps, floaters, layups, power finishes). If their weakness is "Ball handling", most drills should be dribbling drills. Do NOT give them shooting drills when they said their weakness is finishing. MATCH THE DRILLS TO THE WEAKNESS.
- Only include drills that work with their available facilities (e.g. no shooting drills if they only have open space with no hoop)
- Tailor drill complexity to their experience level (beginners get fundamentals, advanced get complex reads and counters)
- Include rest days based on their frequency (if they train 3-4 times a week, include 3-4 rest days)
- Each training day should have 5-7 drills that flow logically (warmup first, skill work in the middle, conditioning at the end)
- Each drill needs: name, duration in minutes, type (warmup/skill/shooting/conditioning), and a detailed 2-3 sentence description explaining exactly what to do
- Name training days after what the player is actually working on (e.g. "Left Hand Finishing" not just "Skills Day")
- Make drills position-specific when possible (point guard drills differ from center drills)
- Include a brief AI insight explaining why the plan is structured this way for THIS specific player

Respond ONLY in this exact JSON format with no other text, no markdown, no code fences:
{
  "weekTitle": "Week 1: [descriptive title based on their weakness and goal]",
  "aiInsight": "[2-3 sentences explaining why this plan is structured this way for this player specifically. Reference their position, weakness, and goal.]",
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
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
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
