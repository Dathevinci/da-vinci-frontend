"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, HelpCircle, ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: "Is this website completely free to use?",
    answer: "Yes! Our platform is 100% free to use. You can watch, track, and discover anime without paying any subscription fees."
  },
  {
    question: "Why are there no ads on the website?",
    answer: "We are proudly an ad-free website. We do not condone annoying pop-up ads or intrusive video advertisements because we hate them just as much as you do. We strive to provide the cleanest, most premium viewing experience possible."
  },
  {
    question: "Do you host the anime videos yourselves?",
    answer: "No. Da-Vinci functions strictly as an index and aggregator. All video content is hosted by non-affiliated third-party servers. We do not host, upload, or manage any of the media files directly."
  },
  {
    question: "How do I report a broken video or episode?",
    answer: "If an episode is not playing, please try waiting a few moments or refreshing the page. If the issue persists, you can contact us directly via our support email."
  },
  {
    question: "Can I download episodes?",
    answer: "Our website does not natively support downloading. However, you might see third-party download manager buttons (like IDM) depending on your personal browser extensions. We do not officially provide or endorse direct download links."
  }
];

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-300 py-20 px-6 sm:px-12 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-purple-500/10 to-transparent pointer-events-none" />
      <div className="absolute -top-[200px] -right-[200px] w-[600px] h-[600px] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-3xl mx-auto relative z-10">
        <Link href="/" className="inline-flex items-center text-purple-400 hover:text-purple-300 font-medium mb-12 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <HelpCircle className="w-6 h-6 text-purple-400" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">Frequently Asked Questions</h1>
        </div>
        
        <p className="text-lg text-slate-400 mb-12">
          Find answers to common questions about our platform. If you need further assistance, feel free to reach out.
        </p>

        <div className="space-y-4 mb-16">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div 
                key={index} 
                className={`bg-white/5 border transition-colors rounded-2xl overflow-hidden ${isOpen ? 'border-purple-500/50' : 'border-white/10 hover:border-white/20'}`}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
                >
                  <span className={`font-bold text-lg ${isOpen ? 'text-white' : 'text-slate-200'}`}>
                    {faq.question}
                  </span>
                  <ChevronDown 
                    className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-purple-400' : ''}`} 
                  />
                </button>
                <div 
                  className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 pb-6 opacity-100' : 'max-h-0 opacity-0'}`}
                >
                  <p className="text-slate-400 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <section className="bg-gradient-to-br from-purple-500/20 to-purple-500/20 border border-purple-500/30 rounded-2xl p-8 text-center sm:text-left sm:flex sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2 text-white">Still have questions?</h2>
            <p className="text-slate-300 mb-6 sm:mb-0">
              We're here to help! Send us an email and we'll get back to you.
            </p>
          </div>
          <a href="mailto:Luc1lfeer@yandex.com" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold transition-colors border border-white/10 whitespace-nowrap">
            Luc1lfeer@yandex.com
          </a>
        </section>
      </div>
    </div>
  );
}
