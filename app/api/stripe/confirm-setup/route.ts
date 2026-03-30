import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    
    // 1. Authenticate the user claiming they verified their card
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name) => cookieStore.get(name)?.value } }
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 2. Use Admin client to update the profile securely
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. Mark the user as verified in the database
    await supabaseAdmin
      .from('profiles')
      .update({ has_payment_method: true })
      .eq('id', user.id);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Stripe confirm error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}