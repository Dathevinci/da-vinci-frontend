import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Scale } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-300 py-20 px-6 sm:px-12 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-500/10 to-transparent pointer-events-none" />
      <div className="absolute -top-[200px] -right-[200px] w-[600px] h-[600px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">
        <Link href="/" className="inline-flex items-center text-blue-400 hover:text-blue-300 font-medium mb-12 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Scale className="w-6 h-6 text-blue-400" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">Terms of Service</h1>
        </div>

        <div className="prose prose-invert prose-blue max-w-none prose-p:leading-relaxed prose-headings:text-white prose-a:text-blue-400 hover:prose-a:text-blue-300">
          <p className="text-lg text-slate-400 mb-12">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          <section className="mb-12 bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing and using this website, you accept and agree to be bound by the terms and provision of this agreement.
              If you do not agree to abide by these terms, please do not use our service.
            </p>
          </section>

          <section className="mb-12 bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4">2. Description of Service</h2>
            <p>
              Da-Vinci acts as an index and database of anime content. We provide a platform for users to discover, track, and watch anime.
              <strong> Important:</strong> We do not host any video files on our own servers. All video content is embedded from third-party hosting services.
            </p>
          </section>

          <section className="mb-12 bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4">3. User Conduct</h2>
            <p>
              You agree to use our service only for lawful purposes. You are prohibited from:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4 text-slate-300">
              <li>Attempting to hack, disrupt, or interfere with the website's servers or network.</li>
              <li>Using automated scripts, bots, or scraping tools without our explicit permission.</li>
              <li>Harassing or abusing other users in community sections.</li>
            </ul>
          </section>

          <section className="mb-12 bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4">4. Intellectual Property Rights</h2>
            
            <h3 className="text-xl font-bold mb-2 text-white">4.1 Ownership</h3>
            <p className="mb-6">
              All content, trademarks, and intellectual property on Da-Vinci, including but not limited to logos, graphics, text, software, and audiovisual materials, are owned by or licensed to Da-Vinci. Unauthorized use of such materials is strictly prohibited.
            </p>

            <h3 className="text-xl font-bold mb-2 text-white">4.2 Anime Content</h3>
            <p className="uppercase text-slate-300 font-bold tracking-wide leading-relaxed border-l-4 border-purple-500 pl-4 mb-4">
              DA-VINCI DOES NOT OWN THE RIGHTS TO PROVIDE THE CONTENT YOU SEE ON THE SITE. The content is provided by third-party anime sources, open-access databases, and other open-access websites. WE DO NOT OWN NOR CONTROL THE CONTENT ON THE WEBSITE. WE SIMPLY PROVIDE LINKS TO IT.
            </p>
            <p className="uppercase text-slate-300 font-bold tracking-wide leading-relaxed border-l-4 border-red-500 pl-4">
              IF BY ANY MEANS YOU ARE AN OWNER OF A WORK SHOWN ON OUR WEBSITE AND YOU LEGALLY OWN THE RIGHTS TO THAT CONTENT, PLEASE IMMEDIATELY CONTACT US VIA THE DMCA PAGE FOUND AT THE BOTTOM OF THE WEBSITE.
            </p>
          </section>

          <section className="mb-12 bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4">5. Modifications to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Your continued use of the service after any such changes constitutes your acceptance of the new Terms of Service.
            </p>
          </section>

          <section className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4 text-white">6. Contact & Copyright Claims</h2>
            <p className="text-slate-300">
              For any questions regarding these terms, or to submit a DMCA takedown request regarding embedded content, please contact us at:
            </p>
            <a href="mailto:Luc1lfeer@yandex.com" className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors border border-white/10">
              Luc1lfeer@yandex.com
            </a>
          </section>
        </div>
      </div>
    </div>
  );
}
