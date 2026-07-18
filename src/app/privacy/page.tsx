import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-300 py-20 px-6 sm:px-12 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />
      <div className="absolute -top-[200px] -right-[200px] w-[600px] h-[600px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">
        <Link href="/" className="inline-flex items-center text-indigo-400 hover:text-indigo-300 font-medium mb-12 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-indigo-400" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">Privacy Policy</h1>
        </div>

        <div className="prose prose-invert prose-indigo max-w-none prose-p:leading-relaxed prose-headings:text-white prose-a:text-indigo-400 hover:prose-a:text-indigo-300">
          <p className="text-lg text-slate-400 mb-12">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          <section className="mb-12 bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4">1. Information We Collect</h2>
            <p>
              We collect information to provide better services to all our users. The types of personal information we collect include:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4 text-slate-300">
              <li><strong>Account Information:</strong> If you create an account, we collect your username, email address, and password.</li>
              <li><strong>Usage Data:</strong> We collect data about how you interact with our platform, including watch history, liked series, and bookmarks.</li>
              <li><strong>Device Information:</strong> We may collect information about the device and browser you use to access our services.</li>
            </ul>
          </section>

          <section className="mb-12 bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4">2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-4 text-slate-300">
              <li>Provide, maintain, and improve our services.</li>
              <li>Personalize your experience by remembering your watch progress and recommending anime.</li>
              <li>Communicate with you regarding updates, security alerts, and support messages.</li>
            </ul>
          </section>

          <section className="mb-12 bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4">3. Data Security & Storage</h2>
            <p>
              We implement industry-standard security measures to protect your personal information. 
              Your data is encrypted in transit and at rest. We do not sell your personal information to third parties under any circumstances.
            </p>
          </section>

          <section className="mb-12 bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4">4. Third-Party Services</h2>
            <p>
              Our platform acts as an index/aggregator and links to external video hosting services. We are not responsible for the privacy practices or content of these third-party services.
            </p>
          </section>

          <section className="bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4 text-white">5. Contact Us</h2>
            <p className="text-slate-300">
              If you have any questions or concerns about this Privacy Policy, please contact us at:
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
