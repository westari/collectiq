export const config = {
  maxDuration: 300,
};

const CLIP_RUBRICS = {
  '1on1': {
    skills: ['ballHandling', 'finishing', 'defense', 'iq', 'athleticism'],
    prompt: 'Watch this 1-on-1 basketball possession. Score the player on ballHandling, finishing, defense, iq, and athleticism using a 1-10 rubric where: 1-2 = beginner, 3-4 = developing, 5-6 = solid, 7-8 = advanced, 9-10 = elite varsity+. Look at: ball handling under pressure, ability to create space, finishing creativity, defensive stance, decision making, athletic movement.',
  },
  'threes': {
    skills: ['shooting', 'shotForm'],
    prompt: 'Watch this player shoot open three pointers. Score shooting and shotForm using a 1-10 rubric where: 1-2 = poor mechanics, 3-4 = inconsistent, 5-6 = solid repeatable, 7-8 = clean form with range, 9-10 = elite. Look at: release point, elbow alignment, follow through, balance, arc, consistency.',
  },
  'dribble': {
    skills: ['ballHandling', 'weakHand', 'creativity'],
    prompt: 'Watch this player do dribble combo moves. Score ballHandling, weakHand, and creativity using a 1-10 rubric where: 1-2 = high loose dribble, 3-4 = developing, 5-6 = tight controlled, 7-8 = advanced both hands, 9-10 = elite. Look at: dribble height, hand strength, weak hand control, move variety, tightness.',
  },
  'finishing': {
    skills: ['finishing', 'weakHand', 'touch'],
    prompt: 'Watch this player finish at the rim with both hands. Score finishing, weakHand, and touch using a 1-10 rubric where: 1-2 = struggles, 3-4 = basic only, 5-6 = solid both hands, 7-8 = creative, 9-10 = elite. Look at: body control, off-hand finishing, touch on rim.',
  },
  'game': {
    skills: ['iq', 'courtVision', 'decisionMaking', 'finishing'],
    prompt: 'Watch this real game footage. Score iq, courtVision, decisionMaking, and finishing using a 1-10 rubric where: 1-2 = limited awareness, 3-4 = developing, 5-6 = solid game sense, 7-8 = advanced playmaker, 9-10 = elite. Look at: how they read defense, pass selection, timing, court awareness, execution.',
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const videoUrl = req.body.videoUrl;
  const clipType = req.body.clipType;
  const playerDescription = req.body.playerDescription || '';

  if (!videoUrl || !clipType) return res.status(400).json({ error: 'Missing required fields' });

  const rubric = CLIP_RUBRICS[clipType];
  if (!rubric) return res.status(400).json({ error: 'Invalid clip type' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const playerIdSection = playerDescription
    ? 'IMPORTANT: The player you are evaluating is described as: "' + playerDescription + '". This description is critical - only score THIS specific player, not anyone else in the video. If you cannot identify them, evaluate the most prominent player. '
    : '';

  const skillsList = rubric.skills.map(s => '"' + s + '": <number 1-10>').join(', ');
  const prompt = playerIdSection + rubric.prompt + ' Return ONLY valid JSON with no markdown, no backticks, no explanation. Format: {' + skillsList + ', "feedback": "1 sentence", "highlight": "best thing", "fix": "biggest fix"}';

  try {
    console.log('Downloading video:', videoUrl);
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      console.error('Video download failed:', videoRes.status);
      return res.status(500).json({ error: 'Failed to download video' });
    }

    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    const videoSize = videoBuffer.length;
    console.log('Video size:', videoSize);

    if (videoSize === 0) return res.status(500).json({ error: 'Video file is empty' });

    const startRes = await fetch(
      'https://generativelanguage.googleapis.com/upload/v1beta/files?key=' + apiKey,
      {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': videoSize.toString(),
          'X-Goog-Upload-Header-Content-Type': 'video/mp4',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file: { display_name: 'assess_' + clipType + '_' + Date.now() } }),
      }
    );

    const uploadUrl = startRes.headers.get('x-goog-upload-url');
    if (!uploadUrl) return res.status(500).json({ error: 'Failed to init upload' });

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Length': videoSize.toString(),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
      },
      body: videoBuffer,
    });

    const fileInfo = await uploadRes.json();
    const fileUri = fileInfo.file?.uri;
    const fileName = fileInfo.file?.name;

    if (!fileUri) {
      console.error('No file URI:', JSON.stringify(fileInfo).substring(0, 300));
      return res.status(500).json({ error: 'Upload to Gemini failed' });
    }

    console.log('Uploaded to Gemini:', fileUri);

    let fileState = fileInfo.file?.state;
    let waitTime = 0;
    while (fileState !== 'ACTIVE' && waitTime < 120000) {
      await new Promise(r => setTimeout(r, 5000));
      waitTime += 5000;
      const checkRes = await fetch('https://generativelanguage.googleapis.com/v1beta/' + fileName + '?key=' + apiKey);
      const checkData = await checkRes.json();
      fileState = checkData.state;
      console.log('State:', fileState, 'wait:', waitTime);
    }

    if (fileState !== 'ACTIVE') return res.status(500).json({ error: 'Video processing took too long' });

    const genRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { file_data: { mime_type: 'video/mp4', file_uri: fileUri } },
              { text: prompt },
            ],
          }],
          generationConfig: { maxOutputTokens: 1500, temperature: 0.4 },
        }),
      }
    );

    const data = await genRes.json();

    if (!genRes.ok) {
      console.error('Gemini gen error:', JSON.stringify(data).substring(0, 500));
      return res.status(500).json({ error: 'Failed to analyze' });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error('No text:', JSON.stringify(data).substring(0, 300));
      return res.status(500).json({ error: 'No analysis returned' });
    }

    console.log('Got text length:', text.length);

    let cleanText = text.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
    }

    const start = cleanText.indexOf('{');
    const end = cleanText.lastIndexOf('}');
    if (start === -1 || end === -1) return res.status(500).json({ error: 'Failed to parse response' });

    let assessment;
    try {
      assessment = JSON.parse(cleanText.substring(start, end + 1));
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr.message);
      console.error('Attempted:', cleanText.substring(start, end + 1).substring(0, 300));
      return res.status(500).json({ error: 'Failed to parse JSON' });
    }

    assessment.clipType = clipType;
    return res.status(200).json(assessment);
  } catch (error) {
    console.error('Assess error:', error.message || error);
    return res.status(500).json({ error: error.message || 'Failed to assess clip' });
  }
}
