"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import {
  PlayCircle,
  ArrowRight,
  FileText,
  MessageSquare,
  Quote,
  CheckCircle,
  Minus,
} from 'lucide-react';

export default function FreeDemoClient() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              <PlayCircle className="w-4 h-4" />
              No Signup Required
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6 leading-tight">
              Try DocTalk Free — No Account Required
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-8">
              Chat with AI about sample documents instantly. No account, no credit card, no email.
              See citation highlighting, multi-format support, and performance modes in action with
              3 demo documents ready to explore.
            </p>
            <Link
              href="/demo"
              className="inline-flex items-center px-8 py-4 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-semibold text-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              Launch Free Demo
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </div>
        </section>

        {/* Instant Demo */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4 text-center">
              Instant Demo — No Setup
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 text-center max-w-2xl mx-auto mb-12">
              Three sample documents are pre-loaded and ready to chat with. Click any document,
              type a question, and see how DocTalk works in seconds.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  title: 'Sample PDF',
                  description: 'A real PDF document ready for AI analysis. Ask questions and see citation highlighting with page-level navigation.',
                },
                {
                  title: 'Sample Report',
                  description: 'Explore how DocTalk handles structured content like sections, headings, and data — with cited answers throughout.',
                },
                {
                  title: 'Sample Document',
                  description: 'A third demo file to try different question styles and see how the AI extracts information across formats.',
                },
              ].map((doc, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6"
                >
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                    <FileText className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                  </div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    {doc.title}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {doc.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What You Get */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6 text-center">
              What You Get in the Demo
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
              {[
                { label: '5 messages per session', description: 'Enough to explore a document and test citation highlighting.' },
                { label: 'Citation highlighting', description: 'Click any numbered citation to jump to the source text.' },
                { label: 'AI-powered answers', description: 'Powered by DeepSeek V3.2 in demo mode for fast responses.' },
                { label: 'Full feature preview', description: 'See the document viewer, chat panel, and citation navigation.' },
              ].map((item, i) => (
                <div key={i} className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">
                      {item.label}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Free Plan vs Paid */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4 text-center">
              Demo vs Free Plan vs Paid Plans
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 text-center max-w-2xl mx-auto mb-10">
              The demo is a preview. Free accounts unlock your own uploads. Paid plans unlock
              more credits and features.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-900">
                    <th className="text-left px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">Feature</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400">Demo</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">Free</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">Plus $9.99/mo</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">Pro $19.99/mo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {[
                    { feature: 'Monthly credits', demo: '5 msgs', free: '500', plus: '3,000', pro: '9,000' },
                    { feature: 'Upload own documents', demo: false, free: true, plus: true, pro: true },
                    { feature: 'Citation highlighting', demo: true, free: true, plus: true, pro: true },
                    { feature: 'Quick + Balanced modes', demo: 'Quick only', free: true, plus: true, pro: true },
                    { feature: 'Thorough mode', demo: false, free: false, plus: true, pro: true },
                    { feature: 'Export', demo: false, free: false, plus: true, pro: true },
                    { feature: 'Custom Instructions', demo: false, free: false, plus: false, pro: true },
                    { feature: 'Signup required', demo: false, free: true, plus: true, pro: true },
                  ].map((row, i) => (
                    <tr key={i} className="bg-white dark:bg-zinc-950">
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.feature}</td>
                      {[row.demo, row.free, row.plus, row.pro].map((val, j) => (
                        <td key={j} className="text-center px-4 py-3">
                          {val === true ? (
                            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mx-auto" />
                          ) : val === false ? (
                            <Minus className="w-5 h-5 text-zinc-300 dark:text-zinc-600 mx-auto" />
                          ) : (
                            <span className="text-sm text-zinc-600 dark:text-zinc-300">{val}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* How to Get Started */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-12 text-center">
              How to Get Started
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  step: '1',
                  icon: PlayCircle,
                  title: 'Click the demo link',
                  description: 'Go to the demo page — no account, no email, nothing to fill in.',
                },
                {
                  step: '2',
                  icon: FileText,
                  title: 'Choose a document',
                  description: 'Pick one of the 3 pre-loaded sample documents to explore.',
                },
                {
                  step: '3',
                  icon: MessageSquare,
                  title: 'Ask a question',
                  description: 'Type any question about the document in the chat panel.',
                },
                {
                  step: '4',
                  icon: Quote,
                  title: 'Click a citation',
                  description: 'Click any numbered citation to jump to the highlighted source text.',
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.step} className="text-center">
                    <div className="w-12 h-12 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-bold text-lg mx-auto mb-4">
                      {item.step}
                    </div>
                    <Icon className="w-6 h-6 text-zinc-600 dark:text-zinc-300 mx-auto mb-3" />
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm mb-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-10 text-center">
              Frequently Asked Questions
            </h2>

            <div className="space-y-6 max-w-3xl mx-auto">
              {[
                {
                  q: 'Is it really free?',
                  a: 'Yes. The demo is completely free. No credit card, no account, no email. Just click and start chatting with AI about the sample documents. If you want to upload your own documents, the free plan gives you 500 credits per month — also with no credit card required.',
                },
                {
                  q: 'Do I need an account?',
                  a: 'Not for the demo. The demo works instantly without any registration. To upload your own documents and save your chat history, you will need a free account, which you can create with Google, Microsoft, or email.',
                },
                {
                  q: 'What happens after the demo?',
                  a: 'Nothing happens automatically. You can use the demo as many times as you want. When you are ready to upload your own documents, create a free account (500 credits/month) or upgrade to Plus ($9.99/month, 3,000 credits) or Pro ($19.99/month, 9,000 credits).',
                },
                {
                  q: 'Can I upload my own documents for free?',
                  a: 'Yes. Create a free account (no credit card needed) and you can upload up to 3 documents (25MB each) with 500 credits per month. That is enough for dozens of questions using Quick mode.',
                },
                {
                  q: 'How many credits do I get?',
                  a: 'The demo does not use credits. Once you have an account, the free plan includes 500 credits per month. Quick mode costs 2 credits per question, Balanced costs 8, and Thorough costs 24. Plus ($9.99) gives you 3,000 credits and Pro ($19.99) gives you 9,000.',
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-6"
                >
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    {item.q}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 py-20 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
              Ready to Try It?
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto mb-8">
              No signup. No credit card. Just click and start chatting with AI about real documents.
            </p>
            <Link
              href="/demo"
              className="inline-flex items-center px-8 py-4 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-semibold text-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              Launch Free Demo
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-sm">
              <Link href="/billing" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                View Pricing
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/features/citations" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Citation Highlighting
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/features/multi-format" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Multi-Format Support
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
