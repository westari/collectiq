const RUBRICS = {
  defense: {
    skills: ['defense', 'athleticism', 'iq'],
    roleHint: 'CRITICAL: In this clip, the player you are evaluating is the DEFENDER, not the ball-handler. Watch the defender. Score the defender. Ignore the offensive player\'s skills entirely.',
    prompt: 'This is an on-ball defense possession. Score the DEFENDER on defense, athleticism, and iq using a 1-10 rubric: 1-2 = beginner, 3-4 = developing, 5-6 = solid, 7-8 = advanced, 9-10 = elite varsity+. Look at: stance width and balance, lateral quickness, hand discipline, ability to stay in front, contesting without fouling, anticipation, effort. Score generously based on what you DO see — only return null if a skill is completely impossible to evaluate from the clip.',
  },
  shooting: {
    skills: ['shooting', 'shotForm'],
    roleHint: 'CRITICAL: In this clip, the player you are evaluating is the SHOOTER. There may not be a defender at all.',
    prompt: 'This is a shooting clip. Score the SHOOTER on shooting and shotForm using a 1-10 rubric: 1-2 = poor mechanics, 3-4 = inconsistent, 5-6 = solid repeatable, 7-8 = clean form with range, 9-10 = elite. Look at: release point, elbow alignment, follow through, balance, arc, consistency, makes vs attempts. Score generously based on what you DO see — only return null if completely impossible to evaluate.',
  },
  finishing: {
    skills: ['finishing', 'weakHand', 'touch'],
    roleHint: 'CRITICAL: In this clip, the player you are evaluating is the FINISHER attacking the rim.',
    prompt: 'This is a finishing clip. Score the FINISHER on finishing, weakHand, and touch using a 1-10 rubric: 1-2 = struggles, 3-4 = basic only, 5-6 = solid both hands, 7-8 = creative and reliable, 9-10 = elite. Look at: body control, off-hand finishing, touch on the rim, ability to absorb contact. SPECIAL RULE: weakHand should ONLY be scored if you actually see the player attempt a finish with their non-dominant hand. If they only used their strong hand the entire clip, return null for weakHand. For other skills, score what you see and only return null if completely impossible to evaluate.',
  },
  oneOnOne: {
    skills: ['ballHandling', 'creativity', 'finishing', 'iq'],
    roleHint: 'CRITICAL: In this clip, the player you are evaluating is the OFFENSIVE player WITH the ball, not the defender.',
    prompt: 'This is a 1-on-1 offensive possession. Score the BALL-HANDLER on ballHandling, creativity, finishing, and iq using a 1-10 rubric: 1-2 = beginner, 3-4 = developing, 5-6 = solid, 7-8 = advanced, 9-10 = elite. Look at: ball handling under pressure, ability to create space, move variety, finishing creativity, decision making against the defender. Score generously based on what you DO see — only return null if completely impossible to evaluate.',
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
    ? 'The player to evaluate is described as: "' + playerDescription + '". Use this to identify them visually. '
    : '';

  const skillsList = rubric.skills.map(s => '"' + s + '": <number 1-10 OR null>').join(', ');
  const prompt = rubric.roleHint + ' ' + playerIdSection + rubric.prompt + ' Return ONLY valid JSON, no markdown, no backticks, no explanation. Format: {' + skillsList + ', "feedback": "1 sentence", "highlight": "best thing", "fix": "biggest fix"}';

  try {
    // Step 1: download the video from Supabase
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      console.error('Failed to fetch video from Supabase:', videoRes.status);
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

    // Step 3: poll until file is ACTIVE
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
      console.error('Gemini file not ACTIVE after polling. Final state:', fileState);
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
    console.log('assess-clip success for', clipType, ':', JSON.stringify(parsed));
    return res.status(200).json(parsed);
  } catch (error) {
    console.error('assess-clip error:', error);
    return res.status(500).json({ error: error.message || 'Internal error' });
  }
}
