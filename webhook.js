// api/webhook.js — Stripe webhook to update user plan after successful payment
export const config = {
  api: {
    bodyParser: true
  },
  maxDuration: 10
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_ANON_KEY;

  try {
    const event = req.body;

    console.log(`Stripe webhook: ${event.type}`);

    // Handle checkout completed
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.supabase_user_id;
      const plan = session.metadata?.plan;
      const stripeCustomerId = session.customer;

      if (userId && plan) {
        // Update user plan in Supabase using service role
        const updateRes = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            plan: plan,
            stripe_customer_id: stripeCustomerId
          })
        });

        console.log(`Updated user ${userId} to plan: ${plan}, status: ${updateRes.status}`);
      }
    }

    // Handle subscription cancelled
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const userId = subscription.metadata?.supabase_user_id;

      if (userId) {
        await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ plan: 'free' })
        });

        console.log(`Downgraded user ${userId} to free (subscription cancelled)`);
      }
    }

    // Handle payment failed
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      console.log(`Payment failed for customer: ${invoice.customer}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.log(`Webhook error: ${error.message}`);
    return res.status(400).json({ error: error.message });
  }
}
