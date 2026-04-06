export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { videoUrl, profile } = req.body;

  if (!videoUrl) return res.status(400).json({ error: 'Video URL is required' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Gemini API key not configured' });

  const playerContext = profile ? `
PLAYER PROFILE:
- Position: ${profile.position}
- Experience: ${profile.experience}
- Goal: ${profile.goal}
- Weakness: ${profile.weakness}
- Left hand: ${profile.leftHand || 'unknown'}
- Go-to move: ${profile.goToMove || 'unknown'}
` : '';

  const prompt = `You are Coach X, an elite basketball analyst. Analyze this game film clip and provide a detailed breakdown.

${playerContext}

Analyze the video and return ONLY valid JSON with no markdown or backticks:
{
  "overallGrade": "A/B/C/D/F",
  "summary": "2-3 sentence overall assessment of the player's performance in this clip.",
  "strengths": [
    {"skill": "skill name", "detail": "specific observation from the film"},
    {"skill": "skill name", "detail": "specific observation from the film"}
  ],
  "weaknesses": [
    {"skill": "skill name", "detail": "specific observation and what to fix"},
    {"skill": "skill name", "detail": "specific observation and what to fix"}
  ],
  "keyPlays": [
    {"timestamp": "approximate time", "description": "what happened", "grade": "good/bad/neutral"}
  ],
  "drillRecommendations": [
    {"name": "drill name", "reason": "why this drill addresses what was seen in the film"},
    {"name": "drill name", "reason": "why this drill addresses what was seen in the film"}
  ],
  "coachNote": "1-2 sentence motivational coaching note based on what was seen"
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                fileData: {
                  mimeType: 'video/mp4',
                  fileUri: videoUrl,
                },
              },
              { text: prompt },
            ],
          }],
          generationConfig: {
            maxOutputTokens: 2000,
            temperature: 0.7,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini error:', JSON.stringify(data).substring(0, 500));
      return res.status(500).json({ error: 'Failed to analyze video' });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(500).json({ error: 'No analysis returned' });

    try {
      var start = text.indexOf('{');
      var end = text.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('No JSON found');
      var analysis = JSON.parse(text.substring(start, end + 1));
      return res.status(200).json(analysis);
    } catch (parseErr) {
      console.error('Parse error:', text.substring(0, 200));
      return res.status(500).json({ error: 'Failed to parse analysis' });
    }
  } catch (error) {
    console.error('Film analysis error:', error);
    return res.status(500).json({ error: 'Failed to analyze video' });
  }
}
