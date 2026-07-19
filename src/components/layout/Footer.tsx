import Link from "next/link";
import { Compass, Code2, MessageCircle, Radio, Heart, ExternalLink, ShieldCheck, Mail, ChevronRight, Layers } from "lucide-react";

export default function Footer() {
  return (
    <footer className="relative mt-20 border-t border-white/10 overflow-hidden bg-[#050505]">
      {/* Decorative Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none transform -translate-y-1/2"></div>
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none transform -translate-y-1/2"></div>
      
      {/* Subtle Top Gradient Line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>

      <div className="container mx-auto px-6 pt-20 pb-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8">
          
          {/* Brand Section */}
          <div className="lg:col-span-4 space-y-6">
            <Link href="/" className="flex items-center gap-3 group inline-flex font-fell font-bold text-3xl tracking-[0.15em] uppercase drop-shadow-md">
              <div className="relative">
                <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full group-hover:bg-purple-500/30 transition-all duration-500"></div>
                <img src="/logo.png" alt="Da Vinci Logo" className="relative w-12 h-12 rounded-full border-2 border-purple-500/30 object-cover group-hover:border-purple-400/50 transition-all duration-500" />
              </div>
              <span className="text-white group-hover:text-purple-100 transition-all duration-300">
                DA <span className="text-purple-400 font-black group-hover:text-purple-400 transition-all duration-300">VINCI</span>
              </span>
            </Link>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm font-medium">
              Your ultimate companion for tracking, discovering, and exploring anime. Seamlessly synced with AniList for a premium, lightning-fast experience.
            </p>
            <div className="pt-2 flex flex-col gap-3">
              <a 
                href="https://discord.gg/dSPPjPUQbM" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 px-5 py-2.5 bg-[#5865F2]/10 hover:bg-[#5865F2]/20 border border-[#5865F2]/20 hover:border-[#5865F2]/50 text-purple-100 text-sm font-semibold rounded-xl transition-all duration-300 group w-fit"
              >
                <svg className="w-5 h-5 fill-[#5865F2] transition-transform group-hover:scale-110 duration-300" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
                </svg>
                Join the Community
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div className="lg:col-span-2">
            <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-6 flex items-center gap-2">
              <Compass className="w-4 h-4 text-purple-400" />
              Explore
            </h4>
            <ul className="space-y-3.5 text-slate-400 font-medium">
              {[
                { name: "Dashboard", href: "/" },
                { name: "Catalog", href: "/explore" },
                { name: "Airing Calendar", href: "/calendar" },
                { name: "Discussions", href: "/community" },
                { name: "Shop", href: "/shop" },
              ].map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="group hover:text-purple-300 transition-all duration-300 inline-flex items-center gap-2">
                    <ChevronRight className="w-3.5 h-3.5 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 text-purple-500 transition-all duration-300" />
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Platform & Resources */}
          <div className="lg:col-span-3">
            <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-6 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              Platform
            </h4>
            <ul className="space-y-3.5 text-slate-400 font-medium">
              <li>
                <Link href="/updates" className="group hover:text-purple-300 transition-all duration-300 inline-flex items-center gap-2">
                  <ChevronRight className="w-3.5 h-3.5 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 text-purple-500 transition-all duration-300" />
                  Developer Updates
                </Link>
              </li>
              <li>
                <a href="https://anilist.co" target="_blank" rel="noopener noreferrer" className="group hover:text-purple-300 transition-all duration-300 inline-flex items-center gap-2">
                  <ChevronRight className="w-3.5 h-3.5 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 text-purple-500 transition-all duration-300" />
                  AniList GraphQL API
                  <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-purple-400 transition-colors" />
                </a>
              </li>
              <li>
                <a href="https://github.com/AniList/ApiV2-GraphQL-Docs" target="_blank" rel="noopener noreferrer" className="group hover:text-purple-300 transition-all duration-300 inline-flex items-center gap-2">
                  <ChevronRight className="w-3.5 h-3.5 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 text-purple-500 transition-all duration-300" />
                  Developer Docs
                  <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-purple-400 transition-colors" />
                </a>
              </li>
            </ul>
          </div>

          {/* Legal & Contact */}
          <div className="lg:col-span-3">
            <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-6 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Legal
            </h4>
            <ul className="space-y-3.5 text-slate-400 font-medium">
              {[
                { name: "Privacy Policy", href: "/privacy" },
                { name: "Terms of Service", href: "/terms" },
                { name: "FAQ", href: "/faq" },
                { name: "DMCA / Copyright", href: "/dmca", highlight: true },
              ].map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className={`group inline-flex items-center gap-2 transition-all duration-300 ${link.highlight ? 'text-red-400/80 hover:text-red-400' : 'hover:text-emerald-300'}`}>
                    <ChevronRight className={`w-3.5 h-3.5 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300 ${link.highlight ? 'text-red-500' : 'text-emerald-500'}`} />
                    {link.name}
                  </Link>
                </li>
              ))}
              <li className="pt-2">
                <a href="mailto:Luc1lfeer@yandex.com" className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium text-slate-300 hover:text-white transition-all duration-300">
                  <Mail className="w-4 h-4 text-purple-400" />
                  Contact Support
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Disclaimer & Copyright */}
        <div className="mt-16 pt-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            
            <div className="flex-1 max-w-2xl text-center md:text-left">
              <p className="text-xs text-slate-500 leading-relaxed">
                Da Vinci is strictly an educational tracker interface. We do not host, scrape, or stream any copyrighted material. All data and images are provided by the AniList API and third-party sources.
              </p>
            </div>

            <div className="flex flex-col items-center md:items-end gap-2 shrink-0">
              <p className="text-sm text-slate-400 font-medium flex items-center gap-1.5">
                Crafted with <Heart className="w-4 h-4 text-red-500 fill-red-500 animate-pulse" /> by <span className="text-white font-bold tracking-wide">Dejavuh</span>
              </p>
              <p className="text-xs text-slate-600 font-medium">
                &copy; {new Date().getFullYear()} Da Vinci Tracker. All rights reserved.
              </p>
            </div>

          </div>
        </div>
      </div>
    </footer>
  );
}
