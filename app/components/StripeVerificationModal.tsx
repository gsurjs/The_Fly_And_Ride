'use client';
import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function CheckoutForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);

    // This securely verifies CVC/Zip and saves the card
    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard`, // Usually handled asynchronously
      },
      redirect: 'if_required'
    });

    if (error) {
      alert(error.message);
    } else {
      // Tell Supabase that the card was added successfully!
      try {
        await fetch('/api/stripe/confirm-setup', { method: 'POST' });
        onSuccess(); // Close the modal and let them bid!
      } catch (err) {
        alert("Failed to update profile. Please try again.");
      }
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <button disabled={!stripe || loading} className="w-full bg-[#ff5a20] text-white py-3 rounded-xl font-bold">
        {loading ? 'Verifying...' : 'Verify Card ($0.00)'}
      </button>
    </form>
  );
}

export default function StripeVerificationModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const [clientSecret, setClientSecret] = useState('');

  useEffect(() => {
    fetch('/api/stripe/setup', { method: 'POST' })
      .then(res => res.json())
      .then(data => setClientSecret(data.clientSecret));
  }, []);

  if (!clientSecret) return <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"><p>Loading secure verification...</p></div>;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-[#1a0a07] border border-[#ff5a20]/30 p-8 rounded-3xl w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/50">✕</button>
        <h2 className="text-2xl font-black text-white mb-2">Verify Your Account</h2>
        <p className="text-white/60 text-sm mb-6">To ensure a safe marketplace, we require a valid credit card on file to list or bid. Your card will not be charged to list a motorcycle.</p>
        
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
          <CheckoutForm onSuccess={onSuccess} />
        </Elements>
      </div>
    </div>
  );
}