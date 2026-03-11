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
  // Set CORS headers
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

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

    // Get the raw text first so we can see what Anthropic returns
    const rawText = await response.text();

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      return res.status(500).json({
        error: 'Invalid response from Anthropic API',
        details: rawText.substring(0, 500)
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || 'Anthropic API error',
        type: data.error?.type || 'unknown',
        status: response.status
      });
    }

    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Internal server error'
    });
  }
}
