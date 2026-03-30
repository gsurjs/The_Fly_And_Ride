/* Auth hold workflow to calculate 5% fee for buyer*/

import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' });

export async function POST(req: Request) {
  const { bidderId, bidAmount, stripeCustomerId } = await req.json();

  // Calculate 5% fee (Stripe expects amounts in cents, so multiply by 100)
  const feeAmountCents = Math.floor(bidAmount * 0.05 * 100);

  try {
    // Look up the customer's default saved payment method
    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: 'card',
    });

    if (paymentMethods.data.length === 0) {
      return NextResponse.json({ error: 'No card on file.' }, { status: 400 });
    }

    // Create a PaymentIntent with capture_method: 'manual'
    // This places a HOLD on the card, but does NOT pull the funds yet.
    const paymentIntent = await stripe.paymentIntents.create({
      amount: feeAmountCents,
      currency: 'usd',
      customer: stripeCustomerId,
      payment_method: paymentMethods.data[0].id,
      off_session: true, // They aren't actively filling out a Stripe form right now
      confirm: true,     // Confirm immediately using the saved card
      capture_method: 'manual', // This makes it a hold, not a charge
      metadata: {
         type: 'bid_fee',
         bid_amount: bidAmount
      }
    });

    return NextResponse.json({ success: true, paymentIntentId: paymentIntent.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}