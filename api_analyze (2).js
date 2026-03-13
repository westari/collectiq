export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    },
    responseLimit: false
  },
  maxDuration: 60
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  // --- USAGE TRACKING ---
  const timestamp = new Date().toISOString();
  const userAgent = req.headers['user-agent'] || 'unknown';
  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  const hasImage = JSON.stringify(req.body).includes('"type":"image"');
  
  // Detect mode from the prompt content
  let mode = 'unknown';
  try {
    const bodyStr = JSON.stringify(req.body);
    if (bodyStr.includes('parlay builder') || bodyStr.includes('Build a ') && bodyStr.includes('-leg parlay')) {
      mode = 'parlay';
    } else if (bodyStr.includes('single pick analysis')) {
      mode = 'single';
    }
  } catch(e) {}

  console.log(JSON.stringify({
    event: 'analysis_request',
    timestamp,
    mode,
    has_image: hasImage,
    ip: ip.split(',')[0].trim(), // first IP if multiple
    user_agent: userAgent.substring(0, 120),
  }));
  // --- END TRACKING ---

  try {
    const requestBody = {
      ...req.body,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search"
        }
      ]
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();
    const data = JSON.parse(responseText);

    // Log success/failure
    console.log(JSON.stringify({
      event: 'analysis_response',
      timestamp: new Date().toISOString(),
      mode,
      success: !data.error,
      model: data.model || 'unknown',
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0,
    }));

    return res.status(200).json(data);
  } catch (error) {
    console.log(JSON.stringify({
      event: 'analysis_error',
      timestamp: new Date().toISOString(),
      mode,
      error: error.message,
    }));
    return res.status(500).json({ error: error.message });
  }
}
