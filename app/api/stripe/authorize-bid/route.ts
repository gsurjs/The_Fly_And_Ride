import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(request: Request) {
  // 1. Move the initialization INSIDE the POST function
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-03-25.dahlia' as any, 
  });
  
  try {
    const body = await request.json();
    const { bidderId, bidAmount, stripeCustomerId } = body;

    // 1. Validate the incoming data
    if (!bidderId || !bidAmount || !stripeCustomerId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields for authorization.' }, 
        { status: 400 }
      );
    }

    // 2. Calculate the 5% buyer's fee with Min/Max Caps
    const BUYERS_FEE_PERCENTAGE = 0.05;
    const MIN_FEE_USD = 250;
    const MAX_FEE_USD = 5000;

    let buyersFee = bidAmount * BUYERS_FEE_PERCENTAGE;

    // Apply the boundaries
    if (buyersFee < MIN_FEE_USD) {
      buyersFee = MIN_FEE_USD;
    } else if (buyersFee > MAX_FEE_USD) {
      buyersFee = MAX_FEE_USD;
    }
    
    // STRIPE RULE: Amounts must be in cents to process the charge
    const amountInCents = Math.round(buyersFee * 100);

    // 3. Create the PaymentIntent to place the hold
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      customer: stripeCustomerId,
      
      // THE MAGIC LINE: Authorize the funds but DO NOT capture them yet.
      capture_method: 'manual', 
      
      // Automatically attempt to confirm the hold using their saved default card
      confirm: true,
      
      // Indicates the customer isn't actively filling out a Stripe checkout form right now
      off_session: true, 
      
      metadata: {
        bidderId: bidderId,
        bidAmount: bidAmount.toString(),
        calculatedFee: buyersFee.toString() // Good for your own Stripe dashboard logs
      },
    });

    // 4. Return the ID back to the frontend to save in your Supabase 'bids' table
    return NextResponse.json({ 
      success: true, 
      paymentIntentId: paymentIntent.id 
    }, { status: 200 });

  } catch (error: any) {
    console.error('Stripe authorization error:', error);
    
    // This catches issues like "Insufficient Funds", "Card Expired", or "Fraud Block"
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Payment authorization failed. Please check your card.' 
    }, { status: 400 });
  }
}