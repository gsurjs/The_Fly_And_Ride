# 🏍️ FLY&RIDE

**The Premier Motorcycle Bidding & Exchange Platform**

FLY&RIDE is a community focused, cinematic auction platform dedicated exclusively to motorcycles. Built with a focus on trust, premium UI/UX, and dynamic performance. It allows enthusiasts to securely buy, sell, and review exclusive motorcycles.

---

## Key Features

* **Dynamic Bidding Engine:** Live auction ledgers built on Supabase, allowing users to place bids and track price action up to the final second.
* **Premium Seller Profiles & Reputation Engine:** * Verified 5-star rating system.
    * Smart Review Logic: Only the verified winning bidder can leave a review, preventing feedback fraud.
    * Rich profiles with custom avatars, bios, and location data.
* **Spotlight Search & Advanced Filtering:** A global, hotkey-enabled search modal that dynamically routes to a responsive marketplace grid. Users can filter by Make, Title Status, Max Mileage, and Sort Order.
* **Cinematic Mobile UI:**
    * Smart responsive image galleries with interactive Fullscreen Lightbox viewing.
    * Dynamic layout shifting
    * Hamburger navigation and touch optimized bidding cards.
* **Secure Dashboard ("My Garage"):** A private management center for users to create listings, compress and upload images, and edit their public profiles.

---

## Tech Stack

**Frontend & Framework:**
* [Next.js 15](https://nextjs.org/) (App Router, Server Components, Suspense boundaries)
* [React 19](https://react.dev/)
* [Tailwind CSS](https://tailwindcss.com/) (Custom UI, dynamic grid layouts, mobile responsiveness)
* `browser-image-compression` (Client-side optimization before storage)

**Backend & Database:**
* [Supabase](https://supabase.com/) (PostgreSQL Database)
* **Supabase Auth:** Secure user authentication and session management.
* **Supabase Storage:** Isolated buckets for vehicle galleries and user avatars.
* **Row Level Security (RLS):** Strict database policies to prevent identity spoofing and review manipulation.