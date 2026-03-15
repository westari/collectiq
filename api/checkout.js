// api/checkout.js — Creates Stripe checkout session for Pro/Ultra upgrade
export const config = {
  api: { bodyParser: true },
  maxDuration: 10
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!stripeSecret) return res.status(500).json({ error: 'Stripe not configured' });

  const { plan, access_token } = req.body;

  // Verify user is logged in
  if (!access_token) return res.status(401).json({ error: 'Not logged in' });

  try {
    // Get user info from Supabase
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${access_token}`, 'apikey': supabaseKey }
    });
    const userData = await userRes.json();
    if (!userData.id) throw new Error('Invalid session');

    // Get the right price ID
    const priceIds = {
      pro: process.env.STRIPE_PRO_PRICE_ID,
      ultra: process.env.STRIPE_ULTRA_PRICE_ID
    };
    const priceId = priceIds[plan];
    if (!priceId) throw new Error('Invalid plan');

    // Create Stripe checkout session
    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('success_url', 'https://tryparlai.com?upgrade=success&plan=' + plan);
    params.append('cancel_url', 'https://tryparlai.com?upgrade=cancelled');
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('customer_email', userData.email);
    params.append('metadata[supabase_user_id]', userData.id);
    params.append('metadata[plan]', plan);
    params.append('subscription_data[metadata][supabase_user_id]', userData.id);
    params.append('subscription_data[metadata][plan]', plan);

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(stripeSecret + ':')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const session = await stripeRes.json();

    if (session.error) throw new Error(session.error.message);

    return res.status(200).json({ url: session.url });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}
