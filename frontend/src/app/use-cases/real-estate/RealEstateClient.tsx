"use client";

import React from 'react';
import Link from 'next/link';
import {
  Home,
  FileText,
  Search,
  ClipboardCheck,
  Upload,
  MessageSquare,
  CheckCircle,
  Lock,
  Shield,
  Scale,
  Briefcase,
  DollarSign,
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
    icon: FileText,
    title: 'Review Lease Agreements',
    description:
      'Upload lease documents and ask about rent escalation clauses, maintenance responsibilities, termination conditions, and renewal options. Get cited answers pointing to the exact provision in the lease.',
  },
  {
    icon: Search,
    title: 'Analyze Inspection Reports',
    description:
      'Upload property inspection PDFs and ask about specific findings, deficiencies, safety concerns, or recommended repairs. The AI cites the exact page and section of the inspection report.',
  },
  {
    icon: DollarSign,
    title: 'Compare Property Appraisals',
    description:
      'Upload appraisal documents and extract comparable sales data, valuation methodology, and adjustment factors. Use Collections to compare appraisals across multiple properties.',
  },
  {
    icon: ClipboardCheck,
    title: 'Extract Terms from Purchase Contracts',
    description:
      'Upload purchase agreements and ask about contingencies, closing dates, earnest money provisions, and seller disclosures. Every answer cites the specific contract clause.',
  },
];

const exampleQuestions = [
  'What is the rent escalation schedule in this lease?',
  'What maintenance responsibilities does the tenant have?',
  'What deficiencies were found in the roof inspection?',
  'What comparable sales were used in this appraisal?',
  'What are the buyer contingencies in this purchase agreement?',
  'When is the lease termination notice deadline?',
];

const docTypes = [
  { format: 'PDF Leases & Contracts', detail: 'Lease agreements, purchase contracts, addendums, and amendments' },
  { format: 'PDF Inspection Reports', detail: 'Home inspections, environmental assessments, and survey reports' },
  { format: 'PDF Appraisals', detail: 'Property appraisals, comparative market analyses, and valuations' },
  { format: 'DOCX Title Documents', detail: 'Title reports, deed descriptions, and HOA documents' },
];

const securityItems = [
  { icon: Lock, title: 'AES-256 Encryption', detail: 'All client documents encrypted at rest with industry-standard encryption' },
  { icon: Shield, title: 'No AI Training', detail: 'Your client documents are never used to train AI models' },
  { icon: FileText, title: 'GDPR Compliant', detail: 'Data export and deletion for compliance with privacy regulations' },
  { icon: CheckCircle, title: 'Account Isolation', detail: 'Each account is fully isolated — client documents are only accessible to you' },
];

const steps = [
  { icon: Upload, step: '1', title: 'Upload Property Documents', description: 'Upload leases, inspection reports, appraisals, or purchase agreements as PDF or DOCX files.' },
  { icon: MessageSquare, step: '2', title: 'Ask About the Document', description: 'Type questions about specific clauses, findings, valuations, or anything in the document.' },
  { icon: CheckCircle, step: '3', title: 'Get Cited Answers', description: 'Receive answers with numbered citations. Click any citation to jump to the exact section in the original document.' },
];

const faqItems = [
  {
    question: 'Can DocTalk review a lease agreement?',
    answer:
      'Yes. Upload a lease as a PDF or DOCX and ask questions like "What is the rent escalation clause?", "What are the maintenance responsibilities?", or "When does the lease terminate?" DocTalk extracts the relevant provisions with numbered citations pointing to the exact section.',
  },
  {
    question: 'Does it work with property inspection PDFs?',
    answer:
      'Yes. DocTalk supports PDF inspection reports. You can ask about specific findings, deficiencies, or recommendations. The AI reads the full report and provides cited answers referencing the exact page and section where each finding appears.',
  },
  {
    question: 'Can I analyze multiple property documents together?',
    answer:
      'Yes. Use Collections to group related documents for a single property — such as the purchase agreement, inspection report, appraisal, and title report. Then ask cross-document questions like "Are there any discrepancies between the inspection report and the seller disclosure?" The AI cites the specific document and passage.',
  },
  {
    question: 'Is client data secure?',
    answer:
      'Yes. All uploaded documents are encrypted with AES-256 encryption at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and you can delete any document at any time. Each user account is isolated and documents are only accessible to the uploader.',
  },
  {
    question: 'Is there a free tier for real estate agents?',
    answer:
      'Yes. DocTalk offers a Free plan with 300 credits per month — enough to try the tool on several documents. The Plus plan ($9.99/month) provides 3,000 credits for regular use, and the Pro plan ($19.99/month) includes 9,000 credits with advanced features like Pro analysis mode.',
  },
];

const relatedUseCases = [
  {
    href: '/use-cases/lawyers',
    icon: Scale,
    title: 'Legal',
    description: 'Review contracts, court filings, and legal documents',
  },
  {
    href: '/use-cases/finance',
    icon: DollarSign,
    title: 'Finance',
    description: 'Analyze financial reports and statements',
  },
  {
    href: '/use-cases/consultants',
    icon: Briefcase,
    title: 'Consultants',
    description: 'Analyze RFPs, market research, and client documents',
  },
];

export default function RealEstateClient() {
  return (
    <MarketingShell
      breadcrumb={[
        { label: 'Home', href: '/' },
        { label: 'Use Cases', href: '/use-cases' },
        { label: 'Real Estate' },
      ]}
    >
      <EdPageHero
        icon={Home}
        title="AI Document Analysis for Real Estate Professionals"
        lede="Review leases, purchase agreements, inspection reports, and appraisals with AI-powered cited answers. Find the clause you need in seconds."
        primaryCta={{ label: 'Try Free Demo', href: '/demo' }}
      />

      <EdSection title="The Document Challenge in Real Estate">
        <EdProse>
          <p>
            Real estate transactions involve a complex web of documents. A single property deal can include a purchase agreement, title report, inspection report, appraisal, seller disclosure, HOA documents, and lease agreements — each running dozens or hundreds of pages.
          </p>
          <p>
            Agents and brokers need to quickly locate specific terms, compare provisions across documents, and identify potential issues before they become problems. Manually searching through stacks of documents is time-consuming and error-prone.
          </p>
          <p>
            Resources like the{' '}
            <a href="https://www.nar.realtor/technology" target="_blank" rel="noopener noreferrer">National Association of Realtors Technology section</a>
            {' '}discuss how technology is transforming how real estate professionals work with documents and data.
          </p>
          <p>
            DocTalk helps by letting you ask natural language questions about any property document and get answers with exact citations. You can verify every detail against the source text in seconds, rather than manually scanning through pages.
          </p>
        </EdProse>
      </EdSection>

      <EdSection alt title="How DocTalk Helps Real Estate Professionals">
        <EdFeatureList
          items={features.map((f) => ({ title: f.title, body: f.description, icon: f.icon }))}
        />
      </EdSection>

      <EdSection title="Supported Property Document Types">
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          DocTalk works with the document formats used in real estate. See{' '}
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

      <EdSection alt title="Example Questions for Real Estate Documents">
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          Upload any property document and try questions like these. Every answer includes citations you can click to jump to the original text.
        </p>
        <EdCardGrid
          columns={2}
          items={exampleQuestions.map((q) => ({ title: q }))}
        />
      </EdSection>

      <EdSection title="Security for Client Documents">
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          Real estate documents contain sensitive client information. DocTalk is built with security as a priority.
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
                  {item.description}
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
        title="Ready to streamline your document review?"
        description="Upload a lease, inspection report, or purchase agreement and see how AI-powered cited answers can help. No credit card required."
        primary={{ label: 'Try Free Demo', href: '/demo' }}
      />
    </MarketingShell>
  );
}
