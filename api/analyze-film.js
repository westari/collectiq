export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var videoUrl = req.body.videoUrl;
  var profile = req.body.profile;

  if (!videoUrl) return res.status(400).json({ error: 'Video URL is required' });

  var apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  var playerInfo = '';
  if (profile) {
    playerInfo = 'Position: ' + (profile.position || '') + ', Weakness: ' + (profile.weakness || '');
  }

  var prompt = 'You are Coach X, an elite basketball analyst. Analyze this game film. ' + playerInfo + ' Return ONLY valid JSON: {"overallGrade":"A or B or C or D or F","summary":"2-3 sentences","strengths":[{"skill":"name","detail":"observation"}],"weaknesses":[{"skill":"name","detail":"what to fix"}],"drillRecommendations":[{"name":"drill","reason":"why"}],"coachNote":"1-2 sentence note"}';

  try {
    // Step 1: Download video from Supabase
    console.log('Downloading video from:', videoUrl);
    var videoRes = await fetch(videoUrl);
    if (!videoRes.ok) return res.status(500).json({ error: 'Failed to download video' });

    var videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    var videoSize = videoBuffer.length;
    console.log('Video size:', videoSize, 'bytes');

    // Step 2: Upload to Gemini File API - start resumable upload
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
        body: JSON.stringify({ file: { display_name: 'game_film_' + Date.now() } }),
      }
    );

    var uploadUrl = startRes.headers.get('x-goog-upload-url');
    if (!uploadUrl) {
      console.error('No upload URL');
      return res.status(500).json({ error: 'Failed to init upload' });
    }

    // Step 3: Upload video data
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

    if (!fileUri) {
      console.error('No file URI:', JSON.stringify(fileInfo).substring(0, 300));
      return res.status(500).json({ error: 'Upload failed' });
    }

    console.log('File uploaded:', fileUri, 'State:', fileInfo.file?.state);

    // Step 4: Wait for ACTIVE state - poll every 5 seconds up to 120 seconds
    var fileState = fileInfo.file?.state;
    var waitTime = 0;

    while (fileState !== 'ACTIVE' && waitTime < 120000) {
      await new Promise(function(r) { setTimeout(r, 5000); });
      waitTime = waitTime + 5000;
      console.log('Waiting for processing... ' + waitTime + 'ms');

      var checkRes = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/' + fileName + '?key=' + apiKey
      );
      var checkData = await checkRes.json();
      fileState = checkData.state;
      console.log('File state:', fileState);
    }

    if (fileState !== 'ACTIVE') {
      console.error('File not active after waiting. State:', fileState);
      return res.status(500).json({ error: 'Video processing took too long. Try a shorter clip.' });
    }

    // Step 5: Generate content
    console.log('Sending to Gemini for analysis...');
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
          generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
        }),
      }
    );

    var data = await genRes.json();

    if (!genRes.ok) {
      console.error('Gemini generate error:', JSON.stringify(data).substring(0, 500));
      return res.status(500).json({ error: 'Failed to analyze video' });
    }

    var text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error('No text in response:', JSON.stringify(data).substring(0, 300));
      return res.status(500).json({ error: 'No analysis returned' });
    }

    console.log('Got analysis response, parsing...');

    var start = text.indexOf('{');
    var end = text.lastIndexOf('}');
    if (start === -1 || end === -1) {
      console.error('No JSON in response:', text.substring(0, 200));
      return res.status(500).json({ error: 'Failed to parse analysis' });
    }

    var analysis = JSON.parse(text.substring(start, end + 1));
    return res.status(200).json(analysis);
  } catch (error) {
    console.error('Film error:', error.message || error);
    return res.status(500).json({ error: 'Failed to analyze video' });
  }
}
