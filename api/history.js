// api/history.js — Save and fetch parlay history from Supabase
export const config = {
  api: { bodyParser: true },
  maxDuration: 10
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  // GET — fetch parlay history for a user
  if (req.method === 'GET') {
    const { user_id, access_token } = req.query;

    if (!access_token) return res.status(401).json({ error: 'Not logged in' });
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

    try {
      // Verify the token is valid
      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { 'Authorization': `Bearer ${access_token}`, 'apikey': supabaseKey }
      });
      const userData = await userRes.json();
      if (!userData.id) return res.status(401).json({ error: 'Invalid session' });

      // Make sure the user is requesting their own data
      if (userData.id !== user_id) return res.status(403).json({ error: 'Forbidden' });

      // Fetch parlays
      const parlaysRes = await fetch(
        `${supabaseUrl}/rest/v1/parlays?user_id=eq.${user_id}&order=created_at.desc&limit=50`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${access_token}`,
          }
        }
      );

      if (!parlaysRes.ok) {
        const errText = await parlaysRes.text().catch(() => 'unknown');
        console.log('Fetch parlays error:', parlaysRes.status, errText.substring(0, 200));
        return res.status(parlaysRes.status).json({ error: 'Failed to fetch history' });
      }

      const parlays = await parlaysRes.json();
      return res.status(200).json(parlays);
    } catch (error) {
      console.log('History GET error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  // POST — save a new parlay
  if (req.method === 'POST') {
    const { access_token, parlay } = req.body;

    if (!access_token) return res.status(401).json({ error: 'Not logged in' });
    if (!parlay) return res.status(400).json({ error: 'Missing parlay data' });

    try {
      // Verify the token
      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { 'Authorization': `Bearer ${access_token}`, 'apikey': supabaseKey }
      });
      const userData = await userRes.json();
      if (!userData.id) return res.status(401).json({ error: 'Invalid session' });

      // Insert parlay
      const insertRes = await fetch(`${supabaseUrl}/rest/v1/parlays`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${access_token}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          user_id: userData.id,
          title: parlay.title || 'AI Parlay',
          sport: parlay.sport || 'unknown',
          legs: parlay.legs || 0,
          combined_odds: parlay.combined_odds || '',
          bet_amount: parlay.bet_amount || '$10',
          payout: parlay.payout || '',
          confidence: parlay.confidence || 0,
          grade: parlay.grade || '',
          legs_data: parlay.legs_data || [],
          result: 'pending'
        })
      });

      if (!insertRes.ok) {
        const errText = await insertRes.text().catch(() => 'unknown');
        console.log('Save parlay error:', insertRes.status, errText.substring(0, 200));
        return res.status(insertRes.status).json({ error: 'Failed to save parlay' });
      }

      console.log('Parlay saved for user:', userData.id);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.log('History POST error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
