import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import BidCard from '../../components/BidCard'; 
import { Suspense } from 'react';

// 1. Next.js 15 strict typing: Params are now a Promise that must be awaited
interface PageProps {
  params: Promise<{ id: string }>;
}

async function ListingContent({ id }: { id: string }) {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() { /* Ignored in server components */ },
      },
    }
  );

  // 2. Fetch the specific motorcycle by its exact URL ID
  const { data: listing, error } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .single();

  // 3. If the user types a random ID that doesn't exist, instantly throw a 404
  if (error || !listing) {
    notFound(); 
  }

  return <BidCard listing={listing} />;
}

export default async function ListingPage({ params }: PageProps) {
  // 4. Await the dynamic URL parameter to satisfy Next.js 15 standards
  const { id } = await params;

  return (
    <main className="min-h-screen bg-black p-4 md:p-10 flex items-center justify-center font-sans">
      <Suspense fallback={<div className="text-white text-xl animate-pulse font-bold tracking-widest uppercase">Fetching Motorcycle Data...</div>}>
        <ListingContent id={id} />
      </Suspense>
    </main>
  );
}