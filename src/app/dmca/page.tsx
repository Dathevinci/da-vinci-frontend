import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldAlert } from 'lucide-react';

export default function DMCAPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-300 py-20 px-6 sm:px-12 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-red-500/10 to-transparent pointer-events-none" />
      <div className="absolute -top-[200px] -right-[200px] w-[600px] h-[600px] bg-red-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">
        <Link href="/" className="inline-flex items-center text-red-400 hover:text-red-300 font-medium mb-12 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-red-400" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">DMCA / Copyright</h1>
        </div>

        <div className="prose prose-invert prose-red max-w-none prose-p:leading-relaxed prose-headings:text-white prose-a:text-red-400 hover:prose-a:text-red-300">
          <p className="text-lg text-slate-400 mb-12">
            Da-Vinci takes intellectual property rights very seriously and complies fully with the Digital Millennium Copyright Act (DMCA).
          </p>

          <section className="mb-12 bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4">Content Disclaimer</h2>
            <p className="uppercase text-slate-300 font-bold tracking-wide leading-relaxed border-l-4 border-purple-500 pl-4 mb-4">
              DA-VINCI DOES NOT OWN THE RIGHTS TO PROVIDE THE CONTENT YOU SEE ON THE SITE. The content is provided by third-party anime sources, open-access databases, and other open-access websites. WE DO NOT OWN NOR CONTROL THE CONTENT ON THE WEBSITE. WE SIMPLY PROVIDE LINKS TO IT.
            </p>
            <p>
              None of the video files or multimedia content shown on this site are hosted on our servers. All video streams are embedded from third-party services and content delivery networks. Because we do not host this content, we cannot physically delete it. However, we will gladly remove the links/embeds from our index upon valid request.
            </p>
          </section>

          <section className="mb-12 bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4">Filing a DMCA Takedown Notice</h2>
            <p>
              If you are a copyright owner or an agent thereof and believe that any content linked on Da-Vinci infringes upon your copyright, you may submit a takedown notification.
            </p>
            <p className="mt-4 font-bold text-white">Your notification must include the following:</p>
            <ul className="list-disc pl-6 space-y-2 mt-4 text-slate-300">
              <li>A physical or electronic signature of a person authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.</li>
              <li>Identification of the copyrighted work claimed to have been infringed.</li>
              <li>Identification of the material that is claimed to be infringing or to be the subject of infringing activity and that is to be removed, including specific URLs to the exact pages containing the links.</li>
              <li>Information reasonably sufficient to permit us to contact you, such as an address, telephone number, and email address.</li>
              <li>A statement that you have a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.</li>
              <li>A statement that the information in the notification is accurate, and under penalty of perjury, that you are authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.</li>
            </ul>
          </section>

          <section className="bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4 text-white">Submit a Request</h2>
            <p className="text-slate-300">
              Please submit your DMCA takedown requests directly to our designated copyright agent via email. Please allow up to 72 hours for a response.
            </p>
            <p className="uppercase text-slate-300 font-bold tracking-wide leading-relaxed border-l-4 border-red-500 pl-4 mt-6">
              IF BY ANY MEANS YOU ARE AN OWNER OF A WORK SHOWN ON OUR WEBSITE AND YOU LEGALLY OWN THE RIGHTS TO THAT CONTENT, PLEASE IMMEDIATELY CONTACT US VIA THIS EMAIL:
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
