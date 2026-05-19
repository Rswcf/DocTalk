"use client";

import React from 'react';
import Link from 'next/link';
import {
  Briefcase,
  FileText,
  Search,
  BarChart3,
  ClipboardCheck,
  Upload,
  MessageSquare,
  CheckCircle,
  TrendingUp,
  Scale,
  Lock,
  Shield,
} from 'lucide-react';
import MarketingShell from '../../../components/marketing/MarketingShell';
import EdPageHero from '../../../components/marketing/EdPageHero';
import EdSection from '../../../components/marketing/EdSection';
import EdProse from '../../../components/marketing/EdProse';
import EdFeatureList from '../../../components/marketing/EdFeatureList';
import EdCardGrid from '../../../components/marketing/EdCardGrid';
import EdStepRow from '../../../components/marketing/EdStepRow';
import EdFaqList from '../../../components/marketing/EdFaqList';
import EdCtaBanner from '../../../components/marketing/EdCtaBanner';

const features = [
  {
    icon: Search,
    title: 'Analyze RFPs Faster',
    description:
      'Upload Request for Proposals and ask DocTalk to extract requirements, timelines, evaluation criteria, and budget constraints. Get cited answers from the exact section of the RFP so you never miss a detail.',
  },
  {
    icon: BarChart3,
    title: 'Extract Insights from Market Research',
    description:
      'Upload market research reports, industry analyses, and competitive landscapes. Ask questions about market size, growth rates, or competitive positioning and get answers cited to the specific data source.',
  },
  {
    icon: TrendingUp,
    title: 'Review Client Financials',
    description:
      'Upload financial statements, annual reports, and budget documents. Ask about revenue trends, cost structures, or capital allocation and receive answers with citations to the exact figures in the source.',
  },
  {
    icon: ClipboardCheck,
    title: 'Prepare Due Diligence',
    description:
      'Use Collections to group multiple client documents — contracts, financials, org charts — and run cross-document queries. Identify risks, inconsistencies, and key terms across the full document set.',
  },
];

const exampleQuestions = [
  'What are the key evaluation criteria in this RFP?',
  'What is the total addressable market size mentioned in this report?',
  'Summarize the main competitive threats identified.',
  'What are the payment terms in this contract?',
  'What was the year-over-year revenue growth?',
  'What risks does the management discussion section highlight?',
];

const docTypes = [
  { format: 'PDF Reports', detail: 'Market research, industry analysis, annual reports, and client deliverables' },
  { format: 'DOCX Proposals', detail: 'RFPs, SOWs, engagement letters, and consulting proposals' },
  { format: 'PPTX Decks', detail: 'Client presentations, strategy decks, and pitch materials' },
  { format: 'XLSX Spreadsheets', detail: 'Financial models, budgets, data tables, and forecasts' },
];

const securityItems = [
  { icon: Lock, title: 'AES-256 Encryption', detail: 'All documents encrypted at rest with industry-standard encryption' },
  { icon: Shield, title: 'No AI Training', detail: 'Your documents are never used to train AI models' },
  { icon: FileText, title: 'GDPR Compliant', detail: 'Data export and deletion capabilities for compliance requirements' },
  { icon: CheckCircle, title: 'Account Isolation', detail: 'Each user account is fully isolated — documents are only accessible to you' },
];

const steps = [
  { icon: Upload, step: '1', title: 'Upload Client Documents', description: 'Upload RFPs, reports, financials, or presentations as PDF, DOCX, PPTX, or XLSX.' },
  { icon: MessageSquare, step: '2', title: 'Ask About the Document', description: 'Type questions about requirements, data points, terms, or anything in the text.' },
  { icon: CheckCircle, step: '3', title: 'Get Cited Answers', description: 'Receive answers with numbered citations. Click any citation to jump to the exact passage in the original document.' },
];

const relatedUseCases = [
  { href: '/use-cases/finance', icon: TrendingUp, title: 'Finance', body: 'Analyze 10-K filings, earnings reports, and financial documents' },
  { href: '/use-cases/lawyers', icon: Scale, title: 'Legal', body: 'Review contracts, court filings, and legal documents' },
  { href: '/use-cases/compliance', icon: Shield, title: 'Compliance', body: 'Analyze regulatory and policy documents' },
];

const faqItems = [
  {
    question: 'Can DocTalk handle confidential client documents?',
    answer:
      'Yes. All uploaded documents are encrypted with AES-256 encryption at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and provides data export and deletion capabilities. Each user account is isolated, and documents are only accessible to the user who uploaded them.',
  },
  {
    question: 'Can I analyze multiple documents at once?',
    answer:
      'Yes. DocTalk supports cross-document Q&A through Collections. You can group related documents — such as an RFP, budget spreadsheet, and org chart — into a single collection and ask questions that span all of them. The AI cites the specific document and passage for each answer.',
  },
  {
    question: 'Does it work with PowerPoint decks?',
    answer:
      'Yes. DocTalk supports PPTX files. You can upload client presentations, pitch decks, and strategy slides. The AI extracts text from all slides and provides cited answers referencing the specific slide content. This is useful for quickly reviewing lengthy presentation decks before client meetings.',
  },
  {
    question: 'What pricing works for consulting firms?',
    answer:
      'DocTalk offers individual plans: Free (300 credits/month), Plus ($9.99/month for 3,000 credits), and Pro ($19.99/month for 9,000 credits). Credit packs are also available for burst usage: Boost (500 credits for $3.99), Power (2,000 for $9.99), and Ultra (5,000 for $19.99). Team plans are on the roadmap.',
  },
  {
    question: 'Can I export analysis results?',
    answer:
      'Yes. Plus and Pro plan users can export chat conversations with all cited answers. This is useful for appending AI analysis summaries to client deliverables or sharing findings with team members who do not have a DocTalk account.',
  },
];

export default function ConsultantsClient() {
  return (
    <MarketingShell
      breadcrumb={[
        { label: 'Home', href: '/' },
        { label: 'Use Cases', href: '/use-cases' },
        { label: 'Consultants & Advisors' },
      ]}
    >
      <EdPageHero
        icon={Briefcase}
        title="AI Document Analysis for Consultants and Advisors"
        lede="Analyze RFPs, market research, financial statements, and client documents with AI-powered cited answers. Deliver faster, more thorough analysis."
        primaryCta={{ label: 'Try Free Demo', href: '/demo' }}
      />

      <EdSection title="The Document Challenge for Consultants">
        <EdProse>
          <p>
            Consultants spend a significant portion of their time reading. Whether it is a 200-page RFP, a stack of market research reports, or a client&apos;s financial statements, the sheer volume of documents requires hours of careful review before any analysis can begin.
          </p>
          <p>
            The pressure to deliver thorough analysis quickly means consultants often need to extract specific data points from dense documents under tight deadlines. Missing a key requirement in an RFP or overlooking a risk factor in a financial report can have serious consequences.
          </p>
          <p>
            Reports like Thomson Reuters&apos;{' '}
            <a href="https://www.thomsonreuters.com/content/dam/ewp-m/documents/thomsonreuters/en/pdf/reports/2026-ai-in-professional-services-report.pdf" target="_blank" rel="noopener noreferrer">AI in Professional Services report</a>
            {' '}highlight how AI is transforming knowledge work and document analysis in professional services.
          </p>
          <p>
            DocTalk accelerates this process by letting you ask questions about any document and receiving answers with exact citations. You can verify every claim against the source in seconds, rather than manually searching through hundreds of pages.
          </p>
        </EdProse>
      </EdSection>

      <EdSection alt title="How DocTalk Helps Consultants">
        <EdFeatureList
          items={features.map((f) => ({ title: f.title, body: f.description, icon: f.icon }))}
        />
      </EdSection>

      <EdSection title="Supported Document Types">
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          DocTalk works with the formats consultants use daily. See{' '}
          <Link href="/features/multi-format" className="ed-inline">
            all supported formats
          </Link>
          {' '}for the full list.
        </p>
        <EdCardGrid
          columns={2}
          items={docTypes.map((d) => ({ title: d.format, body: d.detail }))}
        />
      </EdSection>

      <EdSection alt title="Example Questions Consultants Ask">
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          Upload any client document and try questions like these. Every answer includes citations you can click to jump to the original text.
        </p>
        <EdCardGrid
          columns={2}
          items={exampleQuestions.map((q) => ({ title: q }))}
        />
      </EdSection>

      <EdSection title="Security for Confidential Documents">
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          Client confidentiality is non-negotiable for consultants. DocTalk is built with security as a priority.
        </p>
        <EdCardGrid
          columns={2}
          items={securityItems.map((s) => ({ title: s.title, body: s.detail, icon: s.icon }))}
        />
      </EdSection>

      <EdSection alt title="Get Started in 3 Steps">
        <EdStepRow
          steps={steps.map((s) => ({ title: s.title, body: s.description, icon: s.icon }))}
        />
      </EdSection>

      <EdSection title="Related Use Cases">
        <div
          className="grid grid-cols-1 sm:grid-cols-3"
          style={{ gap: '16px', gridAutoRows: '1fr' }}
        >
          {relatedUseCases.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="ed-card h-full"
                style={{ display: 'flex', flexDirection: 'column' }}
              >
                <div style={{ marginBottom: '10px', color: 'var(--ed-ink-3)' }}>
                  <Icon className="w-4 h-4" />
                </div>
                <h3 className="ed-h3">{item.title}</h3>
                <p className="ed-body" style={{ marginTop: '8px' }}>
                  {item.body}
                </p>
              </Link>
            );
          })}
        </div>
      </EdSection>

      <EdSection alt title="Frequently Asked Questions">
        <EdFaqList items={faqItems} />
      </EdSection>

      <EdCtaBanner
        title="Ready to accelerate your document analysis?"
        description="Upload an RFP, market report, or client document and see how AI-powered cited answers can save hours of review time. No credit card required."
        primary={{ label: 'Try Free Demo', href: '/demo' }}
      />
    </MarketingShell>
  );
}
