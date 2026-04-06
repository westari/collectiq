import { GoogleGenerativeAI } from "@google/generative-ai";

const RUBRICS = {
  defense: {
    skills: ['defense', 'athleticism', 'iq'],
    prompt: 'Watch this player playing on-ball defense for one possession. Score defense, athleticism, and iq using a 1-10 rubric where: 1-2 = beginner, 3-4 = developing, 5-6 = solid, 7-8 = advanced, 9-10 = elite varsity+. Look at: stance width and balance, lateral quickness, hand discipline, ability to stay in front, contest without fouling, anticipation. CRITICAL: If the clip does not clearly show a skill (e.g. the player never has to react athletically, or you cannot see their basketball IQ), return null for that skill instead of guessing a number.',
  },
  shooting: {
    skills: ['shooting', 'shotForm'],
    prompt: 'Watch this player shoot catch-and-shoot or pull-up jumpers. Score shooting and shotForm using a 1-10 rubric where: 1-2 = poor mechanics, 3-4 = inconsistent, 5-6 = solid repeatable, 7-8 = clean form with range, 9-10 = elite. Look at: release point, elbow alignment, follow through, balance, arc, consistency, makes vs attempts. CRITICAL: If the clip does not clearly show a skill, return null for that skill instead of guessing.',
  },
  finishing: {
    skills: ['finishing', 'weakHand', 'touch'],
    prompt: 'Watch this player finish at the rim with both hands. Score finishing, weakHand, and touch using a 1-10 rubric where: 1-2 = struggles, 3-4 = basic only, 5-6 = solid both hands, 7-8 = creative and reliable, 9-10 = elite. Look at: body control, off-hand finishing specifically, touch on the rim, ability to absorb contact. CRITICAL: weakHand should ONLY be scored if you actually see the player finish with their non-dominant hand. If they only used their strong hand, return null for weakHand. Same rule for any skill not clearly demonstrated.',
  },
  oneOnOne: {
    skills: ['ballHandling', 'creativity', 'finishing', 'iq'],
    prompt: 'Watch this 1-on-1 offensive possession. Score ballHandling, creativity, finishing, and iq using a 1-10 rubric where: 1-2 = beginner, 3-4 = developing, 5-6 = solid, 7-8 = advanced, 9-10 = elite. Look at: ball handling under pressure, ability to create space, move variety, finishing creativity, decision making against the defender. CRITICAL: If the clip does not clearly show a skill, return null for that skill instead of guessing.',
  },
};

export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { videoUrl, clipType, playerDescription } = req.body;

  if (!videoUrl || !clipType) {
    return res.status(400).json({ error: 'Missing videoUrl or clipType' });
  }

  const rubric = RUBRICS[clipType];
  if (!rubric) {
    return res.status(400).json({ error: 'Invalid clipType. Must be one of: defense, shooting, finishing, oneOnOne' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  const playerIdSection = playerDescription
    ? 'IMPORTANT: The player you are evaluating is described as: "' + playerDescription + '". Only score THIS specific player, not anyone else in the video. If you cannot identify them, evaluate the most prominent player. '
    : '';

  const skillsList = rubric.skills.map(s => '"' + s + '": <number 1-10 OR null>').join(', ');
  const prompt = playerIdSection + rubric.prompt + ' Return ONLY valid JSON with no markdown, no backticks, no explanation. Format: {' + skillsList + ', "feedback": "1 sentence", "highlight": "best thing", "fix": "biggest fix"}';

  try {
    // Step 1: download the video from Supabase
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      return res.status(500).json({ error: 'Failed to download video from storage' });
    }
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

    // Step 2: upload to Gemini File API
    const uploadRes = await fetch(
      'https://generativelanguage.googleapis.com/upload/v1beta/files?key=' + apiKey,
      {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Protocol': 'raw',
          'Content-Type': 'video/mp4',
        },
        body: videoBuffer,
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error('Gemini upload failed:', errText);
      return res.status(500).json({ error: 'Failed to upload to Gemini' });
    }

    const uploadData = await uploadRes.json();
    const fileUri = uploadData.file.uri;
    const fileName = uploadData.file.name;

    // Step 3: poll until file is ACTIVE (Gemini needs to process the video)
    let fileState = uploadData.file.state;
    let pollAttempts = 0;
    while (fileState === 'PROCESSING' && pollAttempts < 24) {
      await new Promise(r => setTimeout(r, 5000));
      const stateRes = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/' + fileName + '?key=' + apiKey
      );
      const stateData = await stateRes.json();
      fileState = stateData.state;
      pollAttempts++;
    }

    if (fileState !== 'ACTIVE') {
      return res.status(500).json({ error: 'Video processing timed out or failed' });
    }

    // Step 4: send to Gemini for analysis
    const analyzeRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { fileData: { fileUri: fileUri, mimeType: 'video/mp4' } },
              { text: prompt },
            ],
          }],
        }),
      }
    );

    if (!analyzeRes.ok) {
      const errText = await analyzeRes.text();
      console.error('Gemini analyze failed:', errText);
      return res.status(500).json({ error: 'Gemini analysis failed' });
    }

    const analyzeData = await analyzeRes.json();
    let responseText = analyzeData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Strip markdown backticks if Gemini wrapped the JSON
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse Gemini response:', responseText.substring(0, 300));
      return res.status(500).json({ error: 'Failed to parse Gemini response' });
    }

    parsed.clipType = clipType;
    return res.status(200).json(parsed);
  } catch (error) {
    console.error('assess-clip error:', error);
    return res.status(500).json({ error: error.message || 'Internal error' });
  }
}
