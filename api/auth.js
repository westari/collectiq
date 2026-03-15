// api/auth.js — Handles user session and tier info
export const config = {
  api: { bodyParser: true },
  maxDuration: 10
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const { action, email, password, access_token } = req.body;

  try {
    if (action === 'signup') {
      // Create new account
      const signupRes = await fetch(`${supabaseUrl}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({ email, password })
      });
      const data = await signupRes.json();
      if (data.error) throw new Error(data.error.message || data.msg || 'Signup failed');
      return res.status(200).json({ success: true, user: data.user || data, session: data.session });

    } else if (action === 'login') {
      // Sign in
      const loginRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({ email, password })
      });
      const data = await loginRes.json();
      if (data.error) throw new Error(data.error_description || data.error || data.msg || 'Login failed');
      return res.status(200).json({ success: true, user: data.user, session: { access_token: data.access_token, refresh_token: data.refresh_token } });

    } else if (action === 'get_user') {
      // Get current user info + plan
      if (!access_token) throw new Error('No token provided');
      
      // Get user from Supabase auth
      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'apikey': supabaseKey
        }
      });
      const userData = await userRes.json();
      if (userData.error) throw new Error('Session expired');

      // Get user plan from our users table
      const planRes = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userData.id}&select=*`, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'apikey': supabaseKey
        }
      });
      const planData = await planRes.json();
      
      const userPlan = planData && planData.length > 0 ? planData[0] : { plan: 'free', parlays_used_this_week: 0 };

      // Check if week needs resetting (reset every Monday)
      const now = new Date();
      const resetAt = new Date(userPlan.week_reset_at);
      const daysSinceReset = (now - resetAt) / (1000 * 60 * 60 * 24);
      if (daysSinceReset >= 7) {
        // Reset weekly usage
        await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userData.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${access_token}`,
            'apikey': supabaseKey
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
          plan: userPlan.plan,
          parlays_used: userPlan.parlays_used_this_week,
          limits: getPlanLimits(userPlan.plan)
        }
      });

    } else if (action === 'increment_usage') {
      // Increment parlay usage counter
      if (!access_token) throw new Error('No token provided');
      
      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { 'Authorization': `Bearer ${access_token}`, 'apikey': supabaseKey }
      });
      const userData = await userRes.json();
      if (userData.error) throw new Error('Session expired');

      // Get current usage
      const planRes = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userData.id}&select=*`, {
        headers: { 'Authorization': `Bearer ${access_token}`, 'apikey': supabaseKey }
      });
      const planData = await planRes.json();
      const current = planData && planData.length > 0 ? planData[0] : null;
      if (!current) throw new Error('User not found');

      const limits = getPlanLimits(current.plan);
      
      // Check if under limit
      if (limits.parlays_per_period !== -1 && current.parlays_used_this_week >= limits.parlays_per_period) {
        return res.status(403).json({ error: 'Usage limit reached', limit: limits.parlays_per_period, used: current.parlays_used_this_week, plan: current.plan });
      }

      // Increment
      await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userData.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${access_token}`,
          'apikey': supabaseKey
        },
        body: JSON.stringify({ parlays_used_this_week: current.parlays_used_this_week + 1 })
      });

      return res.status(200).json({ success: true, used: current.parlays_used_this_week + 1, limit: limits.parlays_per_period });

    } else if (action === 'logout') {
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

function getPlanLimits(plan) {
  const plans = {
    free: {
      parlays_per_period: 3, // per week
      period: 'week',
      has_screenshot: false,
      has_analyze_pick: false,
      has_web_search: false,
      model: 'claude-haiku-4-5-20251001'
    },
    pro: {
      parlays_per_period: 15, // per month
      period: 'month',
      has_screenshot: true,
      has_analyze_pick: true,
      has_web_search: true,
      model: 'claude-haiku-4-5-20251001'
    },
    ultra: {
      parlays_per_period: -1, // unlimited
      period: 'unlimited',
      has_screenshot: true,
      has_analyze_pick: true,
      has_web_search: true,
      model: 'claude-sonnet-4-5-20250929'
    }
  };
  return plans[plan] || plans.free;
}
