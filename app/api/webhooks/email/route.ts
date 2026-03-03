import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const transporter = nodemailer.createTransport({
  host: 'mail.privateemail.com',
  port: 465,
  secure: true, 
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Helper for the from address
const FROM_EMAIL = '"FLY&RIDE" <noreply@theflyandride.com>';

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const secret = url.searchParams.get('secret');
    
    if (secret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized hacker attempt blocked' }, { status: 401 });
    }

    const payload = await req.json();
    const { type, table, record, old_record } = payload;

    // =========================================================================
    // SCENARIO 1: LISTING APPROVED (Admin -> Seller)
    // =========================================================================
    if (table === 'listings' && type === 'UPDATE') {
      if (old_record?.status === 'pending' && record?.status === 'active') {
        const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(record.seller_id);
        
        if (user?.email) {
          await transporter.sendMail({
            from: FROM_EMAIL,
            to: user.email,
            subject: '✅ Your Motorcycle is LIVE on FLY&RIDE!',
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #1a0a07; color: white; padding: 40px; border-radius: 16px;">
                <h1 style="color: #ff5a20; margin-bottom: 8px;">Congratulations!</h1>
                <p style="font-size: 16px; line-height: 1.5;">Your <strong>${record.year} ${record.make} ${record.model}</strong> has been approved.</p>
                <a href="https://theflyandride.com/listing/${record.id}" style="display: inline-block; background-color: #ff5a20; color: white; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 8px; margin-top: 20px;">VIEW LIVE AUCTION</a>
              </div>
            `,
          });
        }
      }
    }

    // =========================================================================
    // SCENARIO 2: NEW BID PLACED (Notify Seller & Outbid Buyer)
    // =========================================================================
    if (table === 'bids' && type === 'INSERT') {
      // 1. Fetch the listing to know what bike this is for
      const { data: listing } = await supabaseAdmin
        .from('listings')
        .select('id, make, model, year, seller_id')
        .eq('id', record.listing_id)
        .single();

      if (listing) {
        // --- A. NOTIFY THE SELLER ---
        if (listing.seller_id !== record.bidder_id) { // Don't email if they bid on their own bike (if allowed)
          const { data: { user: seller } } = await supabaseAdmin.auth.admin.getUserById(listing.seller_id);
          if (seller?.email) {
            await transporter.sendMail({
              from: FROM_EMAIL,
              to: seller.email,
              subject: `💰 New Bid: $${record.amount.toLocaleString()} on your ${listing.make}!`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #1a0a07; color: white; padding: 40px; border-radius: 16px;">
                  <h1 style="color: #4ade80;">New Bid Placed!</h1>
                  <p style="font-size: 16px;">Someone just bid <strong>$${record.amount.toLocaleString()}</strong> on your ${listing.year} ${listing.make} ${listing.model}.</p>
                  <a href="https://theflyandride.com/listing/${listing.id}" style="display: inline-block; background-color: #4ade80; color: #1a0a07; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 8px; margin-top: 20px;">VIEW AUCTION</a>
                </div>
              `,
            });
          }
        }

        // --- B. NOTIFY THE OUTBID BUYER ---
        // Fetch the top 2 highest bids to find who just got knocked down
        const { data: topBids } = await supabaseAdmin
          .from('bids')
          .select('bidder_id')
          .eq('listing_id', record.listing_id)
          .order('amount', { ascending: false })
          .limit(2);

        // If there's a 2nd highest bidder, and it's not the exact same person who just bid
        if (topBids && topBids.length === 2 && topBids[1].bidder_id !== record.bidder_id) {
          const { data: { user: outbidUser } } = await supabaseAdmin.auth.admin.getUserById(topBids[1].bidder_id);
          if (outbidUser?.email) {
            await transporter.sendMail({
              from: FROM_EMAIL,
              to: outbidUser.email,
              subject: `⚠️ You've been outbid on the ${listing.make} ${listing.model}!`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #1a0a07; color: white; padding: 40px; border-radius: 16px;">
                  <h1 style="color: #ef4444;">You were just outbid!</h1>
                  <p style="font-size: 16px;">The current bid on the ${listing.year} ${listing.make} ${listing.model} is now <strong>$${record.amount.toLocaleString()}</strong>.</p>
                  <p style="font-size: 16px;">Don't let it slip away. Get back in the action!</p>
                  <a href="https://theflyandride.com/listing/${listing.id}" style="display: inline-block; background-color: #ef4444; color: white; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 8px; margin-top: 20px;">PLACE A NEW BID</a>
                </div>
              `,
            });
          }
        }
      }
    }

    // =========================================================================
    // SCENARIO 3: NEW COMMENT (Notify Seller)
    // =========================================================================
    if (table === 'comments' && type === 'INSERT') {
      const { data: listing } = await supabaseAdmin
        .from('listings')
        .select('id, make, model, year, seller_id')
        .eq('id', record.listing_id)
        .single();

      if (listing && listing.seller_id !== record.user_id) { // Don't email if the seller answers their own question
        const { data: { user: seller } } = await supabaseAdmin.auth.admin.getUserById(listing.seller_id);
        if (seller?.email) {
          await transporter.sendMail({
            from: FROM_EMAIL,
            to: seller.email,
            subject: `💬 New Question on your ${listing.make} ${listing.model}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #1a0a07; color: white; padding: 40px; border-radius: 16px;">
                <h1 style="color: #3b82f6;">New Comment</h1>
                <p style="font-size: 16px;">A potential buyer just asked a question on your ${listing.year} ${listing.make} auction.</p>
                <p style="font-size: 16px; font-style: italic; background-color: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px;">"${record.content}"</p>
                <a href="https://theflyandride.com/listing/${listing.id}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 8px; margin-top: 20px;">REPLY TO BUYER</a>
              </div>
            `,
          });
        }
      }
    }

    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}