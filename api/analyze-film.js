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

  const playerContext = profile ? 'Position: ' + (profile.position || '') + ', Experience: ' + (profile.experience || '') + ', Goal: ' + (profile.goal || '') + ', Weakness: ' + (profile.weakness || '') : '';

  const prompt = 'You are Coach X, an elite basketball analyst. Analyze this game film clip. ' + playerContext + ' Return ONLY valid JSON with no markdown or backticks: {"overallGrade":"A/B/C/D/F","summary":"2-3 sentence assessment","strengths":[{"skill":"name","detail":"observation"}],"weaknesses":[{"skill":"name","detail":"what to fix"}],"keyPlays":[{"timestamp":"time","description":"what happened","grade":"good/bad/neutral"}],"drillRecommendations":[{"name":"drill","reason":"why"}],"coachNote":"1-2 sentence coaching note"}';

  try {
    var videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      return res.status(500).json({ error: 'Failed to download video from storage' });
    }
    var videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    var videoBase64 = videoBuffer.toString('base64');

    var geminiResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inlineData: {
                  mimeType: 'video/mp4',
                  data: videoBase64,
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

    var data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error('Gemini error:', JSON.stringify(data).substring(0, 500));
      return res.status(500).json({ error: 'Failed to analyze video' });
    }

    var text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(500).json({ error: 'No analysis returned' });

    var start = text.indexOf('{');
    var end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return res.status(500).json({ error: 'Failed to parse analysis' });

    var analysis = JSON.parse(text.substring(start, end + 1));
    return res.status(200).json(analysis);
  } catch (error) {
    console.error('Film analysis error:', error);
    return res.status(500).json({ error: 'Failed to analyze video' });
  }
}
