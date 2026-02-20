'use client'; // tells Next.js this component handles browser interactivity

export default function BidCard({ listing }: { listing: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl w-full">
      
      {/* LEFT COLUMN: The Motorcycle Image */}
      <div className="relative rounded-3xl overflow-hidden shadow-2xl h-[600px] bg-black">
        {/* Placeholder for the actual image. In production, use next/image */}
        <img 
          src="https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?q=80&w=2070" 
          alt="Ducati Panigale V4"
          className="object-cover w-full h-full opacity-90"
        />
        <div className="absolute top-4 left-4 flex gap-2">
          <button className="bg-white/20 backdrop-blur-md p-3 rounded-full hover:bg-white/30 transition">
             ←
          </button>
        </div>
      </div>

      {/* RIGHT COLUMN: The Bidding Interface */}
      <div className="flex flex-col text-white space-y-6">
        
        {/* Header */}
        <div>
          <p className="text-white/60 text-sm tracking-wider uppercase font-semibold mb-2">Back to Garage</p>
          <h1 className="text-5xl font-extrabold tracking-tight mb-4">
            {listing.make} <br /> {listing.model}
          </h1>
          <p className="text-sm text-white/80 leading-relaxed">
            <span className="text-[#ff5a20] font-bold">FUN FACT:</span> This specific model was the first street bike to feature the Desmosedici Stradale engine, derived directly from MotoGP.
          </p>
        </div>

        {/* Market Value & Bid Section */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-10">
            <span className="text-xs font-bold text-white/50 tracking-widest uppercase">:: Market Value History</span>
            <span className="bg-white/10 px-3 py-1 rounded-md text-sm font-semibold">$24,500 AVG</span>
          </div>
          
          {/* Chart Placeholder */}
          <div className="h-24 flex items-end gap-2 mb-6 opacity-60">
             {/* We will replace these with a real charting library later */}
            {[40, 60, 50, 80, 70, 90, 85, 95, 60, 50, 70].map((h, i) => (
              <div key={i} className="flex-1 bg-gradient-to-t from-white/10 to-white/40 rounded-t-sm" style={{ height: `${h}%` }}></div>
            ))}
          </div>

          <div className="flex justify-between items-center">
             <div>
                <button className="bg-white/90 text-black text-sm font-bold px-4 py-2 rounded-full mr-3">View Data</button>
                <span className="text-xs text-white/50 font-semibold tracking-wide">LAST 6 MONTHS</span>
             </div>
             <button className="bg-[#ff5a20] hover:bg-[#ff4500] transition-colors text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-[#ff5a20]/20">
               PLACE BID
             </button>
          </div>
        </div>

        {/* Specs Row */}
        <div className="grid grid-cols-4 gap-4 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div>
            <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider mb-1">Mileage</p>
            <p className="font-bold text-lg">{listing.mileage.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider mb-1">Location</p>
            <p className="font-bold text-lg">{listing.location}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider mb-1">Title</p>
            <p className="font-bold text-lg text-green-400">{listing.title_status}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider mb-1">Ends In</p>
            <p className="font-bold text-lg text-[#ff5a20]">4h 12m</p>
          </div>
        </div>

      </div>
    </div>
  );
}