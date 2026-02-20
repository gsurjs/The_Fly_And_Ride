import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import Navbar from "./components/Navbar"; // Your new global navigation

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

// Updated the metadata to reflect your brand instead of the starter kit defaults
export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Fly&Ride | Premium Motorcycle Bidding",
  description: "Securely buy and sell exclusive motorcycles.",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased min-h-screen bg-[#6b2a1a]`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* The Navbar is injected globally here */}
          <Navbar />
          
          {/* The rest of your pages (like /dashboard and /login) render inside children */}
          {children}
          
        </ThemeProvider>
      </body>
    </html>
  );
}