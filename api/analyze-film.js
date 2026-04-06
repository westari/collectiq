export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var videoBase64 = req.body.videoBase64;
  var profile = req.body.profile;

  if (!videoBase64) return res.status(400).json({ error: 'Video is required' });

  var apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  var playerInfo = '';
  if (profile) {
    playerInfo = 'Position: ' + (profile.position || '') + ', Weakness: ' + (profile.weakness || '');
  }

  var prompt = 'You are Coach X, an elite basketball analyst. Analyze this game film. ' + playerInfo + ' Return ONLY valid JSON: {"overallGrade":"A or B or C or D or F","summary":"2-3 sentences","strengths":[{"skill":"name","detail":"observation"}],"weaknesses":[{"skill":"name","detail":"what to fix"}],"drillRecommendations":[{"name":"drill","reason":"why"}],"coachNote":"1-2 sentence note"}';

  try {
    console.log('Video base64 length:', videoBase64.length);

    var genRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: 'video/mp4', data: videoBase64 } },
              { text: prompt },
            ],
          }],
          generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
        }),
      }
    );

    var data = await genRes.json();

    if (!genRes.ok) {
      console.error('Gemini error:', JSON.stringify(data).substring(0, 500));
      return res.status(500).json({ error: 'Failed to analyze video' });
    }

    var text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(500).json({ error: 'No analysis returned' });

    var start = text.indexOf('{');
    var end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return res.status(500).json({ error: 'Failed to parse' });

    var analysis = JSON.parse(text.substring(start, end + 1));
    return res.status(200).json(analysis);
  } catch (error) {
    console.error('Error:', error.message || error);
    return res.status(500).json({ error: 'Failed to analyze video' });
  }
}
