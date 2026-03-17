// api/auth.js — Handles user session and tier info
export const config = {
  api: { bodyParser: true },
  maxDuration: 10
};

export default async function handler(req, res) {
  // CORS headers for mobile app
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log('Missing env vars:', { hasUrl: !!supabaseUrl, hasKey: !!supabaseKey });
    return res.status(500).json({ error: 'Auth not configured' });
  }

  const { action, email, password, access_token } = req.body;
  console.log(`Auth action: ${action}`);

  // Standard headers for all Supabase requests
  const supaHeaders = {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`
  };

  try {
    if (action === 'signup') {
      const signupRes = await fetch(`${supabaseUrl}/auth/v1/signup`, {
        method: 'POST',
        headers: supaHeaders,
        body: JSON.stringify({ email, password })
      });
      const data = await signupRes.json();
      console.log(`Signup response status: ${signupRes.status}`, JSON.stringify(data).substring(0, 200));
      if (data.error) throw new Error(data.error.message || data.msg || JSON.stringify(data.error));
      return res.status(200).json({ success: true, user: data.user || data, session: data.session });

    } else if (action === 'login') {
      const loginRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: supaHeaders,
        body: JSON.stringify({ email, password })
      });
      const data = await loginRes.json();
      console.log(`Login response status: ${loginRes.status}`, JSON.stringify(data).substring(0, 200));
      if (data.error) throw new Error(data.error_description || data.error || data.msg || JSON.stringify(data.error));
      return res.status(200).json({
        success: true,
        user: data.user,
        session: { access_token: data.access_token, refresh_token: data.refresh_token }
      });

    } else if (action === 'get_user') {
      if (!access_token) throw new Error('No token provided');

      // Get user from Supabase auth
      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${access_token}`
        }
      });
      const userData = await userRes.json();
      console.log(`Get user status: ${userRes.status}`);
      if (userRes.status !== 200 || userData.error) throw new Error('Session expired');

      // Get user plan from our users table
      const planRes = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userData.id}&select=*`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${access_token}`
        }
      });
      const planData = await planRes.json();
      console.log(`Plan data status: ${planRes.status}, rows: ${planData.length || 0}`);

      const userPlan = planData && planData.length > 0 ? planData[0] : { plan: 'free', parlays_used_this_week: 0 };

      // Check if week needs resetting
      const now = new Date();
      const resetAt = new Date(userPlan.week_reset_at || now);
      const daysSinceReset = (now - resetAt) / (1000 * 60 * 60 * 24);
      if (daysSinceReset >= 7) {
        await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userData.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${access_token}`
          },
          body: JSON.stringify({ parlays_used_this_week: 0, week_reset_at: now.toISOString() })
        });
        userPlan.parlays_used_this_week = 0;
      }

      return res.status(200).json({
        success: true,
        user: {
          id: userData.id,
          email: userData.email,
          plan: userPlan.plan || 'free',
          parlays_used: userPlan.parlays_used_this_week || 0,
          limits: getPlanLimits(userPlan.plan || 'free')
        }
      });

    } else if (action === 'increment_usage') {
      if (!access_token) throw new Error('No token provided');

      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${access_token}` }
      });
      const userData = await userRes.json();
      if (userRes.status !== 200) throw new Error('Session expired');

      const planRes = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userData.id}&select=*`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${access_token}` }
      });
      const planData = await planRes.json();
      const current = planData && planData.length > 0 ? planData[0] : null;
      if (!current) throw new Error('User not found');

      const limits = getPlanLimits(current.plan);

      if (limits.parlays_per_period !== -1 && current.parlays_used_this_week >= limits.parlays_per_period) {
        return res.status(403).json({
          error: 'Usage limit reached',
          limit: limits.parlays_per_period,
          used: current.parlays_used_this_week,
          plan: current.plan
        });
      }

      await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userData.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${access_token}`
        },
        body: JSON.stringify({ parlays_used_this_week: current.parlays_used_this_week + 1 })
      });

      return res.status(200).json({ success: true, used: current.parlays_used_this_week + 1, limit: limits.parlays_per_period });

    } else if (action === 'logout') {
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.log(`Auth error (${action}): ${error.message}`);
    return res.status(400).json({ error: error.message });
  }
}

function getPlanLimits(plan) {
  const plans = {
    free: {
      parlays_per_period: 2,
      period: 'week',
      has_screenshot: false,
      has_analyze_pick: false,
      has_web_search: false,
      model: 'claude-haiku-4-5-20251001'
    },
    pro: {
      parlays_per_period: 15,
      period: 'month',
      has_screenshot: true,
      has_analyze_pick: true,
      has_web_search: true,
      model: 'claude-haiku-4-5-20251001'
    },
    ultra: {
      parlays_per_period: -1,
      period: 'unlimited',
      has_screenshot: true,
      has_analyze_pick: true,
      has_web_search: true,
      model: 'claude-sonnet-4-5-20250929'
    }
  };
  return plans[plan] || plans.free;
}
