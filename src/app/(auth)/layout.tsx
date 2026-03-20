import Link from "next/link";
import { Search, Zap, BarChart3 } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Branded panel — charcoal with gold accents, hidden on mobile */}
      <div className="relative hidden w-[45%] max-w-xl flex-col justify-between overflow-hidden bg-[#1a1a1e] p-10 lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(202,168,83,0.12),transparent_60%)]" />

        <div className="relative">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold text-white">
            <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-xs font-black text-[#1a1a1e]">
              H
            </div>
            HeavyLeads
          </Link>
        </div>

        <div className="relative space-y-8">
          <h2 className="text-2xl font-bold leading-snug text-white">
            Construction lead intelligence
            <br />
            <span className="bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">for winning teams.</span>
          </h2>

          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/10">
                <Search className="size-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Daily Lead Feed</p>
                <p className="text-sm text-[#8a8a95]">
                  Permits, bids, and news filtered to your area
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/10">
                <Zap className="size-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Smart Scoring</p>
                <p className="text-sm text-[#8a8a95]">
                  Leads ranked by equipment match and proximity
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/10">
                <BarChart3 className="size-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Multi-Source</p>
                <p className="text-sm text-[#8a8a95]">
                  Cross-referenced from permits, bids, and industry news
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-[#555560]">
          &copy; {new Date().getFullYear()} HeavyLeads. All rights reserved.
        </p>
      </div>

      {/* Form side */}
      <div className="flex flex-1 flex-col">
        {/* Mobile header */}
        <div className="flex items-center gap-2 px-6 py-4 lg:hidden">
          <div className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-amber-400 to-amber-600 text-[10px] font-black text-[#1a1a1e]">
            H
          </div>
          <Link href="/" className="text-xl font-bold">
            HeavyLeads
          </Link>
        </div>

        <main
          id="main-content"
          className="flex flex-1 items-center justify-center p-6"
        >
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}
