import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  // --- INITIALIZE CLIENTS INSIDE THE FUNCTION ---
  // This prevents Vercel build errors by ensuring environment variables
  // are only read at runtime, not during the static build phase.
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! 
  );

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { 
    apiVersion: '2026-03-25.dahlia' as any 
  });

  // --- SECURITY CHECK ---
  // Ensure this request is actually coming from our GitHub Action
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('Unauthorized cron attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Find all auctions that have ended but haven't been processed yet
    const now = new Date().toISOString();
    const { data: endedListings, error: fetchError } = await supabase
      .from('listings')
      .select('*')
      .lt('ends_at', now)
      .eq('status', 'live'); // Assuming 'live' is active status

    if (fetchError) throw fetchError;

    if (!endedListings || endedListings.length === 0) {
      return NextResponse.json({ message: 'No ended auctions to process.' }, { status: 200 });
    }

    for (const listing of endedListings) {
      try {
        // 2. Fetch all bids for this listing, ordered highest to lowest
        const { data: bids } = await supabase
          .from('bids')
          .select('*')
          .eq('listing_id', listing.id)
          .order('amount', { ascending: false });

        if (!bids || bids.length === 0) {
          // No bids at all
          await supabase.from('listings').update({ status: 'ended_unsold' }).eq('id', listing.id);
          continue;
        }

        const highestBid = bids[0];

        // 3. Determine if Reserve was Met
        if (highestBid.amount >= listing.reserve_price) {
          // WINNER: Capture the 5% hold
          try {
            if (highestBid.payment_intent_id) {
              await stripe.paymentIntents.capture(highestBid.payment_intent_id);
            }
            await supabase.from('listings').update({ status: 'sold' }).eq('id', listing.id);
          } catch (err) {
            console.error(`Failed to capture funds for listing ${listing.id}`, err);
          }
        } else {
          // RESERVE NOT MET: Even the highest bidder gets their hold released
          await supabase.from('listings').update({ status: 'reserve_not_met' }).eq('id', listing.id);
        }

        // 4. Release holds for all losing bids (or everyone if reserve not met)
        const losingBids = highestBid.amount >= listing.reserve_price ? bids.slice(1) : bids;
        
        for (const losingBid of losingBids) {
          if (losingBid.payment_intent_id) {
            try {
              await stripe.paymentIntents.cancel(losingBid.payment_intent_id);
            } catch (err) {
              console.error(`Failed to cancel hold for bid ${losingBid.id}`, err);
            }
          }
        }
      } catch (auctionError) {
        console.error(`Error processing individual auction ${listing.id}:`, auctionError);
      }
    }

    return NextResponse.json({ success: true, processed: endedListings.length }, { status: 200 });
  } catch (error: any) {
    console.error('Fatal error in process-auctions cron:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}