import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase-server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed.`, err.message);
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;

    if (orderId) {
      const { error } = await supabaseAdmin
        .from('orders')
        .update({ status: 'paid' })
        .eq('id', orderId);

      if (error) {
        console.error('Error updating order status:', error);
      } else {
        console.log(`Order ${orderId} marked as paid`);
        // Start the processing job
        try {
          const jobResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/jobs/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId }),
          });
          if (!jobResponse.ok) {
            console.error('Failed to start job');
          }
        } catch (err) {
          console.error('Error starting job:', err);
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}