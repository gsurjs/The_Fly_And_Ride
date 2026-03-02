import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

// 1. Initialize the Admin Supabase Client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 2. Initialize your Namecheap PrivateEmail Transporter
const transporter = nodemailer.createTransport({
  host: 'mail.privateemail.com',
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function POST(req: Request) {
  try {
    // SECURITY CHECK: Ensure this ping actually came from Supabase
    const url = new URL(req.url);
    const secret = url.searchParams.get('secret');
    
    if (secret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized hacker attempt blocked' }, { status: 401 });
    }

    // Grab the payload that Supabase just sent us
    const payload = await req.json();
    const { type, table, record, old_record } = payload;

    // =========================================================================
    // SCENARIO 1: A listing was APPROVED by an Admin
    // =========================================================================
    if (table === 'listings' && type === 'UPDATE') {
      
      // Did the status specifically change from 'pending' to 'active'?
      if (old_record?.status === 'pending' && record?.status === 'active') {
        
        // Use the Admin key to securely look up the seller's email address
        const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(record.seller_id);
        
        if (user?.email) {
          // Fire off the email!
          await transporter.sendMail({
            from: '"FLY&RIDE" <noreply@theflyandride.com>', // MUST match your SMTP_USER
            to: user.email,
            subject: '✅ Your Motorcycle is LIVE on FLY&RIDE!',
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #1a0a07; color: white; padding: 40px; border-radius: 16px;">
                <h1 style="color: #ff5a20; margin-bottom: 8px;">Congratulations!</h1>
                <p style="font-size: 16px; line-height: 1.5;">Your <strong>${record.year} ${record.make} ${record.model}</strong> has been approved by our moderation team.</p>
                <p style="font-size: 16px; line-height: 1.5;">Buyers can now view your listing, ask questions, and start bidding. Good luck with your auction!</p>
                <br/>
                <a href="https://theflyandride.com/listing/${record.id}" style="display: inline-block; background-color: #ff5a20; color: white; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 8px; letter-spacing: 1px;">VIEW LIVE AUCTION</a>
              </div>
            `,
          });
          console.log(`Approved email sent to ${user.email}`);
        }
      }
    }

    // PLACEHOLDER FOR OUTBID SCENARIO

    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}