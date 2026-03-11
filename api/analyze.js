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
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const requestBody = {
    ...req.body,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search"
      }
    ]
  };

  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
      });

      const raw = await response.text();

      let data;
      try {
        data = JSON.parse(raw);
      } catch (parseErr) {
        return res.status(500).json({
          error: 'Invalid response from Anthropic API',
          details: raw.substring(0, 500)
        });
      }

      // If overloaded and we have retries left, wait and try again
      if (data.error && data.error.type === 'overloaded_error' && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
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
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }
      return res.status(500).json({
        error: err.message || 'Internal server error'
      });
    }
  }
}
