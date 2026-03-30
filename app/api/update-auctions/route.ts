import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia', // Use your current Stripe API version
});

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! 
  );

  try {
    const now = new Date().toISOString();

    const { data: expiredListings, error: fetchError } = await supabaseAdmin
      .from('listings')
      .select('id, reserve_price')
      .eq('status', 'active') 
      .lte('ends_at', now);

    if (fetchError) throw fetchError;

    if (!expiredListings || expiredListings.length === 0) {
      return NextResponse.json({ message: 'No auctions to update.' }, { status: 200 });
    }

    for (const listing of expiredListings) {
      // Wrap the individual loop in a try/catch. 
      // If one Stripe payment fails, we don't want it to crash the whole cron job 
      // and leave other expired auctions stuck in 'active' status.
      try {
        const { data: highestBid } = await supabaseAdmin
          .from('bids')
          .select('amount, bidder_id, payment_intent_id')
          .eq('listing_id', listing.id)
          .order('amount', { ascending: false })
          .limit(1)
          .single();

        let newStatus = 'ended'; 

        if (highestBid && highestBid.payment_intent_id) {
          if (highestBid.amount >= listing.reserve_price) {
            newStatus = 'sold';
            
            // RESERVE MET: Capture the authorized hold
            console.log(`Capturing payment ${highestBid.payment_intent_id} for listing ${listing.id}`);
            await stripe.paymentIntents.capture(highestBid.payment_intent_id);
            
          } else {
            newStatus = 'reserve_not_met';
            
            // RESERVE NOT MET: Release the hold back to the user's card
            console.log(`Canceling payment ${highestBid.payment_intent_id} for listing ${listing.id}`);
            await stripe.paymentIntents.cancel(highestBid.payment_intent_id);
          }
        }

        // Update the database with the new status
        await supabaseAdmin
          .from('listings')
          .update({ status: newStatus })
          .eq('id', listing.id);

      } catch (auctionError) {
        // Log the specific error for this auction, but let the loop continue
        console.error(`Failed to process auction ${listing.id}:`, auctionError);
      }
    }

    return NextResponse.json({ success: true, count: expiredListings.length }, { status: 200 });

  } catch (error: any) {
    console.error('Fatal error updating auctions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}