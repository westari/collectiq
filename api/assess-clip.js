export const config = {
  maxDuration: 300,
};

// Skill rubrics for each clip type
var CLIP_RUBRICS = {
  '1on1': {
    skills: ['ballHandling', 'finishing', 'defense', 'iq', 'athleticism'],
    prompt: 'You are watching a basketball player in a 1-on-1 possession. Score them on these skills using a 1-10 rubric where: 1-2 = beginner (struggles with basics), 3-4 = developing (inconsistent), 5-6 = solid (reliable fundamentals), 7-8 = advanced (creative and confident), 9-10 = elite (high school varsity+ level). Look at: ball handling under pressure, ability to create space, finishing creativity, defensive stance, decision making, and athletic movement.',
  },
  'threes': {
    skills: ['shooting', 'shotForm'],
    prompt: 'You are watching a basketball player shoot 2-3 open three pointers. Score them on shooting and shot form using a 1-10 rubric where: 1-2 = poor mechanics, 3-4 = inconsistent form, 5-6 = solid repeatable form, 7-8 = clean form with range, 9-10 = elite shooter. Look at: release point, elbow alignment, follow through, balance, arc, and consistency between shots.',
  },
  'dribble': {
    skills: ['ballHandling', 'weakHand', 'creativity'],
    prompt: 'You are watching a basketball player do dribble combo moves. Score them on ball handling, weak hand, and creativity using a 1-10 rubric where: 1-2 = high loose dribble, 3-4 = developing control, 5-6 = tight controlled handle, 7-8 = advanced moves with both hands, 9-10 = elite handle. Look at: dribble height, hand strength, weak hand control, move variety, and tightness.',
  },
  'finishing': {
    skills: ['finishing', 'weakHand', 'touch'],
    prompt: 'You are watching a basketball player finish at the rim with both hands. Score them on finishing, weak hand, and touch using a 1-10 rubric where: 1-2 = struggles to finish, 3-4 = makes basic layups only, 5-6 = solid both hands, 7-8 = creative finishes and good touch, 9-10 = elite finisher. Look at: body control, off-hand finishing ability, touch on the rim, and finishing variety.',
  },
  'game': {
    skills: ['iq', 'courtVision', 'decisionMaking', 'finishing'],
    prompt: 'You are watching real game footage of a basketball player. Score them on basketball IQ, court vision, decision making, and finishing using a 1-10 rubric where: 1-2 = limited awareness, 3-4 = developing reads, 5-6 = solid game sense, 7-8 = advanced playmaker, 9-10 = elite IQ. Look at: how they read the defense, pass selection, timing, court awareness, and execution.',
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var videoUrl = req.body.videoUrl;
  var clipType = req.body.clipType;
  var profile = req.body.profile;

  if (!videoUrl || !clipType) return res.status(400).json({ error: 'Missing required fields' });

  var rubric = CLIP_RUBRICS[clipType];
  if (!rubric) return res.status(400).json({ error: 'Invalid clip type' });

  var apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  var skillsList = rubric.skills.map(function(s) { return '"' + s + '": <1-10 number>'; }).join(', ');
  var prompt = rubric.prompt + ' Return ONLY valid JSON: {' + skillsList + ', "feedback": "1-2 sentence honest assessment", "highlight": "the single best thing you saw", "fix": "the single biggest thing to improve"}';

  try {
    // Download video from Supabase
    var videoRes = await fetch(videoUrl);
    if (!videoRes.ok) return res.status(500).json({ error: 'Failed to download video' });

    var videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    var videoSize = videoBuffer.length;

    // Upload to Gemini File API
    var startRes = await fetch(
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

    var uploadUrl = startRes.headers.get('x-goog-upload-url');
    if (!uploadUrl) return res.status(500).json({ error: 'Failed to init upload' });

    var uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Length': videoSize.toString(),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
      },
      body: videoBuffer,
    });

    var fileInfo = await uploadRes.json();
    var fileUri = fileInfo.file?.uri;
    var fileName = fileInfo.file?.name;

    if (!fileUri) return res.status(500).json({ error: 'Upload failed' });

    // Wait for file to be ACTIVE
    var fileState = fileInfo.file?.state;
    var waitTime = 0;

    while (fileState !== 'ACTIVE' && waitTime < 120000) {
      await new Promise(function(r) { setTimeout(r, 5000); });
      waitTime = waitTime + 5000;

      var checkRes = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/' + fileName + '?key=' + apiKey
      );
      var checkData = await checkRes.json();
      fileState = checkData.state;
    }

    if (fileState !== 'ACTIVE') {
      return res.status(500).json({ error: 'Video processing took too long' });
    }

    // Generate assessment
    var genRes = await fetch(
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

    var data = await genRes.json();

    if (!genRes.ok) {
      console.error('Gemini error:', JSON.stringify(data).substring(0, 500));
      return res.status(500).json({ error: 'Failed to assess clip' });
    }

    var text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(500).json({ error: 'No assessment returned' });

    var start = text.indexOf('{');
    var end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return res.status(500).json({ error: 'Failed to parse' });

    var assessment = JSON.parse(text.substring(start, end + 1));
    assessment.clipType = clipType;

    return res.status(200).json(assessment);
  } catch (error) {
    console.error('Assess error:', error.message || error);
    return res.status(500).json({ error: 'Failed to assess clip' });
  }
}
