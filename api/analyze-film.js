// ============================================================
// DRILL LIBRARY INDEX — synced with expo/constants/drillLibrary.ts
// Coach X must recommend drills BY ID from this list. He cannot invent.
// ============================================================
const DRILL_INDEX = `
BALL HANDLING:
bh-1|Pound Dribbles|skill|beginner|5min|ballHandling
bh-3|In & Out Dribble|skill|intermediate|6min|ballHandling
bh-4|Crossover Dribble|skill|beginner|8min|ballHandling
bh-5|Between the Legs Dribble|skill|intermediate|6min|ballHandling
bh-6|Behind the Back Dribble|skill|intermediate|6min|ballHandling
bh-9|Two Ball Pound Dribble|skill|advanced|5min|weakHand
bh-12|Cone Zig-Zag Dribble|skill|beginner|8min|ballHandling
bh-14|Hesitation Dribble|skill|intermediate|6min|ballHandling
bh-15|Speed Dribble|skill|beginner|5min|ballHandling
bh-16|Stationary Combo Dribbles|skill|intermediate|8min|ballHandling
bh-19|Chair Change of Direction Drill|skill|intermediate|8min|ballHandling
bh-20|Weak Hand Only Dribble|skill|beginner|10min|weakHand
bh-23|Tight Space Dribbling|skill|advanced|8min|ballHandling
bh-25|Attack Cone Dribble|skill|intermediate|8min|ballHandling
bh-26|Move Chaining Drill|skill|intermediate|8min|creativity
bh-27|Random Move Drill|skill|intermediate|8min|creativity
bh-28|Counter Move Drill|skill|advanced|8min|creativity
bh-30|Weak Hand Combo Series|skill|intermediate|8min|weakHand

SHOOTING:
sh-1|Form Shooting|shooting|beginner|5min|shotForm
sh-3|BEEF Shooting Drill|shooting|beginner|8min|shotForm
sh-6|Catch and Shoot|shooting|intermediate|8min|shooting
sh-7|Off the Dribble Pull Up|shooting|intermediate|10min|shooting
sh-8|5 Spot Shooting|shooting|intermediate|12min|shooting
sh-11|Corner Shooting|shooting|intermediate|8min|shooting
sh-12|Wing Shooting|shooting|intermediate|8min|shooting
sh-13|Free Throw Routine|shooting|beginner|10min|touch
sh-14|Chair Curl Shooting|shooting|intermediate|10min|shooting
sh-16|Step Back Shooting|shooting|advanced|8min|shooting
sh-17|Pump Fake One Dribble Shot|shooting|intermediate|8min|shooting
sh-21|Closeout Shooting|shooting|advanced|8min|decisionMaking
sh-22|Quick Release Shooting|shooting|advanced|8min|shooting
sh-26|Elbow Alignment Drill|shooting|beginner|6min|shotForm
sh-27|Guide Hand Removal Drill|shooting|beginner|6min|shotForm
sh-28|Dip Fix Drill|shooting|intermediate|6min|shotForm

FINISHING:
fn-1|Mikan Drill|skill|beginner|5min|finishing
fn-3|Power Layups|skill|beginner|8min|finishing
fn-4|Weak Hand Layups|skill|beginner|10min|weakHand
fn-5|Euro Step Finish|skill|intermediate|8min|finishing
fn-7|Floater Drill|skill|intermediate|8min|touch
fn-8|Runner Finish|skill|intermediate|8min|touch
fn-12|Inside Hand Finish|skill|intermediate|6min|finishing
fn-14|Pro Hop Finish|skill|intermediate|8min|finishing
fn-18|Up and Under Finish|skill|advanced|8min|finishing
fn-23|High Glass Finish|skill|beginner|6min|touch
fn-26|Weak Hand Finishing Series|skill|intermediate|10min|weakHand

DEFENSE:
df-1|Defensive Slide Drill|skill|beginner|8min|defense
df-2|Closeout Drill|skill|intermediate|8min|defense
df-4|Mirror Drill|skill|intermediate|6min|defense
df-9|1 on 1 Full Court Defense|skill|advanced|10min|defense
df-12|Defensive Stance Holds|skill|beginner|5min|defense
df-14|Ball Pressure Drill|skill|intermediate|8min|defense
df-16|Recover Drill|skill|intermediate|6min|defense
df-19|Contest Without Fouling Drill|skill|intermediate|8min|defense

SPEED & AGILITY:
sa-1|Ladder Quick Feet|conditioning|beginner|5min|athleticism
sa-3|Ladder Icky Shuffle|conditioning|intermediate|5min|athleticism
sa-5|5-10-5 Shuttle Run|conditioning|intermediate|5min|athleticism
sa-14|Reaction Sprint Drill|conditioning|intermediate|6min|athleticism
sa-25|Acceleration Sprints|conditioning|beginner|5min|athleticism

BASKETBALL IQ:
iq-1|Read and React Drill|skill|intermediate|10min|decisionMaking
iq-3|Pick and Roll Read Drill|skill|advanced|10min|decisionMaking
iq-4|Drive and Kick Drill|skill|intermediate|8min|courtVision
iq-7|Shot Selection Drill|skill|intermediate|10min|decisionMaking
iq-14|Spacing Drill|skill|intermediate|10min|iq
iq-17|Closeout Decision Drill|skill|advanced|8min|decisionMaking
iq-26|Head Up Dribble Drill|skill|beginner|6min|courtVision
iq-27|Scan and Pass Drill|skill|intermediate|8min|courtVision
`.trim();

export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const videoUrl = req.body.videoUrl;
  const profile = req.body.profile;

  if (!videoUrl) return res.status(400).json({ error: 'Video URL is required' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  let playerInfo = '';
  if (profile) {
    playerInfo = 'PLAYER CONTEXT:\nPosition: ' + (profile.position || 'unknown') + '\nWeakness: ' + (profile.weakness || 'unknown');
    if (profile.description) {
      playerInfo += '\nDescription: ' + profile.description;
    }
  }

  const prompt = `You are Coach X, an elite basketball trainer reviewing a player's game film. Talk to them DIRECTLY — like a real coach.

${playerInfo}

============================================================
DRILL LIBRARY — YOU MUST RECOMMEND DRILLS BY ID FROM THIS LIST.
DO NOT INVENT DRILLS. DO NOT MAKE UP NAMES.
Format: id|name|type|difficulty|duration|primarySkill
============================================================
${DRILL_INDEX}
============================================================

YOUR JOB:
1. Watch the film and grade their game (A, A-, B+, B, B-, C+, C, C-, D, F).
2. Pick 3 strengths you see.
3. Pick 3 things to work on (weaknesses).
4. Recommend 4 drills from the library above to fix the weaknesses. Match drillId to weakness.
5. Speak DIRECTLY to the player. Don't say "the player" — say "you."

TONE: Real coach, not a robot. Direct, honest, no fluff. Examples:
- "Your handle is solid but predictable — defenders are reading you."
- "You attack the rim hard. Keep doing that."
- "Your shot form falls apart when you're tired. We'll fix that."

Return ONLY valid JSON, no markdown:
{
  "overallGrade": "B-",
  "openingLine": "One sentence Coach X would say first when talking to the player. Direct.",
  "summary": "2-3 sentences talking TO the player about their game.",
  "strengths": [
    {"skill": "Short name", "detail": "What you do well, in 1-2 sentences. Talk to them directly."}
  ],
  "weaknesses": [
    {"skill": "Short name", "detail": "What's holding you back, in 1-2 sentences. Direct."}
  ],
  "drillRecommendations": [
    {"drillId": "bh-14", "reason": "Why this drill fixes the issue. Talk to them directly. 1 sentence."}
  ],
  "coachNote": "Final 1-2 sentence note from Coach X. Motivating but real."
}`;

  try {
    // ---------- Step 1: Download video from Supabase ----------
    console.log('Downloading video from:', videoUrl);
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) return res.status(500).json({ error: 'Failed to download video' });

    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    const videoSize = videoBuffer.length;
    console.log('Video size:', videoSize, 'bytes');

    // ---------- Step 2: Start resumable upload to Gemini ----------
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
        body: JSON.stringify({ file: { display_name: 'game_film_' + Date.now() } }),
      }
    );

    const uploadUrl = startRes.headers.get('x-goog-upload-url');
    if (!uploadUrl) {
      console.error('No upload URL');
      return res.status(500).json({ error: 'Failed to init upload' });
    }

    // ---------- Step 3: Upload video data ----------
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
      return res.status(500).json({ error: 'Upload failed' });
    }

    console.log('File uploaded:', fileUri, 'State:', fileInfo.file?.state);

    // ---------- Step 4: Wait for ACTIVE state ----------
    let fileState = fileInfo.file?.state;
    let waitTime = 0;

    while (fileState !== 'ACTIVE' && waitTime < 120000) {
      await new Promise(r => setTimeout(r, 5000));
      waitTime = waitTime + 5000;

      const checkRes = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/' + fileName + '?key=' + apiKey
      );
      const checkData = await checkRes.json();
      fileState = checkData.state;
    }

    if (fileState !== 'ACTIVE') {
      console.error('File not active. State:', fileState);
      return res.status(500).json({ error: 'Video processing took too long. Try a shorter clip.' });
    }

    // ---------- Step 5: Analyze with Gemini ----------
    console.log('Sending to Gemini for analysis...');
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
          generationConfig: { maxOutputTokens: 4000, temperature: 0.7 },
        }),
      }
    );

    const data = await genRes.json();

    if (!genRes.ok) {
      console.error('Gemini error:', JSON.stringify(data).substring(0, 500));
      return res.status(500).json({ error: 'Failed to analyze video' });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error('No text in response');
      return res.status(500).json({ error: 'No analysis returned' });
    }

    // Strip markdown backticks if present
    const cleanText = text.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
    const start = cleanText.indexOf('{');
    const end = cleanText.lastIndexOf('}');
    if (start === -1 || end === -1) {
      console.error('No JSON in response:', cleanText.substring(0, 200));
      return res.status(500).json({ error: 'Failed to parse analysis' });
    }

    const analysis = JSON.parse(cleanText.substring(start, end + 1));

    // Defensive defaults so the UI never breaks
    if (!Array.isArray(analysis.strengths)) analysis.strengths = [];
    if (!Array.isArray(analysis.weaknesses)) analysis.weaknesses = [];
    if (!Array.isArray(analysis.drillRecommendations)) analysis.drillRecommendations = [];
    if (!analysis.overallGrade) analysis.overallGrade = 'C';
    if (!analysis.summary) analysis.summary = 'Analysis complete.';
    if (!analysis.coachNote) analysis.coachNote = '';
    if (!analysis.openingLine) analysis.openingLine = '';

    return res.status(200).json(analysis);
  } catch (error) {
    console.error('Film error:', error.message || error);
    return res.status(500).json({ error: 'Failed to analyze video' });
  }
}
