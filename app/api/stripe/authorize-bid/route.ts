import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  // Initialize Stripe
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-03-25.dahlia' as any, 
  });

  // Initialize Admin DB to look up previous holds securely
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  try {
    const body = await request.json();
    const { bidderId, bidAmount, stripeCustomerId, listingId } = body;

    // 1. Validate the incoming data
    if (!bidderId || !bidAmount || !stripeCustomerId || !listingId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields for authorization.' }, 
        { status: 400 }
      );
    }

    // 2. Fetch the customer's securely saved cards from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: 'card',
    });

    if (!paymentMethods.data || paymentMethods.data.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No saved payment method found. Please verify a card first.' }, 
        { status: 400 }
      );
    }

    const paymentMethodId = paymentMethods.data[0].id;

    // ==========================================
    // 3. THE FIX: PREVENT STACKING HOLDS
    // ==========================================
    const { data: previousBid } = await supabaseAdmin
      .from('bids')
      .select('payment_intent_id')
      .eq('listing_id', listingId)
      .eq('bidder_id', bidderId)
      .not('payment_intent_id', 'is', null) // Only grab bids that had a successful hold
      .order('amount', { ascending: false })
      .limit(1)
      .single();

    // If they have an old hold, cancel it before placing the new one
    if (previousBid?.payment_intent_id) {
      try {
        await stripe.paymentIntents.cancel(previousBid.payment_intent_id);
        console.log(`Cancelled previous hold ${previousBid.payment_intent_id} to prevent stacking.`);
      } catch (err: any) {
        // If it fails (e.g., already expired naturally), just log it and move on
        console.log("Could not cancel previous hold (may have already expired):", err.message);
      }
    }

    // 4. Calculate the 5% buyer's fee with Min/Max Caps
    const BUYERS_FEE_PERCENTAGE = 0.05;
    const MIN_FEE_USD = 250;
    const MAX_FEE_USD = 5000;

    let buyersFee = bidAmount * BUYERS_FEE_PERCENTAGE;

    if (buyersFee < MIN_FEE_USD) {
      buyersFee = MIN_FEE_USD;
    } else if (buyersFee > MAX_FEE_USD) {
      buyersFee = MAX_FEE_USD;
    }
    
    const amountInCents = Math.round(buyersFee * 100);

    // 5. Create the PaymentIntent to place the hold
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      customer: stripeCustomerId,
      payment_method: paymentMethodId,
      capture_method: 'manual', 
      confirm: true,
      off_session: true, 
      metadata: {
        bidderId: bidderId,
        listingId: listingId, // Added to Stripe dashboard tracking
        bidAmount: bidAmount.toString(),
        calculatedFee: buyersFee.toString() 
      },
    });

    // 6. Return the ID back to the frontend to save in your Supabase 'bids' table
    return NextResponse.json({ 
      success: true, 
      paymentIntentId: paymentIntent.id 
    }, { status: 200 });

  } catch (error: any) {
    console.error('Stripe authorization error:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Payment authorization failed. Please check your card.' 
    }, { status: 400 });
  }
}