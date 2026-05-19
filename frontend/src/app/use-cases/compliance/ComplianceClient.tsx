"use client";

import React from 'react';
import Link from 'next/link';
import {
  Shield,
  FileText,
  Search,
  ClipboardCheck,
  Upload,
  MessageSquare,
  CheckCircle,
  Lock,
  AlertTriangle,
  GitCompare,
  Scale,
  Heart,
  TrendingUp,
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
    title: 'Analyze Regulatory Documents',
    description:
      'Upload regulations, guidelines, or standards and ask about specific requirements, definitions, timelines, and penalties. Get cited answers pointing to the exact section, clause, or article in the regulatory text.',
  },
  {
    icon: AlertTriangle,
    title: 'Review Internal Policies for Gaps',
    description:
      'Upload your internal policies alongside the relevant regulation using Collections. Ask the AI to identify where your policy addresses — or fails to address — specific regulatory requirements.',
  },
  {
    icon: ClipboardCheck,
    title: 'Extract Requirements from Frameworks',
    description:
      'Upload compliance frameworks (SOC 2, ISO 27001, NIST, etc.) and extract specific controls, requirements, and evidence criteria. Every answer cites the exact framework section.',
  },
  {
    icon: GitCompare,
    title: 'Compare Policy Versions',
    description:
      'Upload two versions of a policy into a Collection and ask what changed. The AI identifies additions, removals, and modifications with citations to both versions so you can track policy evolution.',
  },
];

const exampleQuestions = [
  'What are the data retention requirements in this regulation?',
  'What penalties apply for non-compliance with section 12?',
  'Summarize the reporting obligations for data breaches.',
  'Does our internal policy address the encryption requirements in section 5.3?',
  'What controls does SOC 2 Type II require for access management?',
  'What changed between v2.1 and v3.0 of this policy?',
];

const docTypes = [
  { format: 'PDF Regulations', detail: 'Federal and state regulations, guidelines, directives, and standards' },
  { format: 'PDF Compliance Frameworks', detail: 'SOC 2, ISO 27001, NIST CSF, GDPR text, and industry standards' },
  { format: 'DOCX Internal Policies', detail: 'Company policies, procedures, handbooks, and governance documents' },
  { format: 'PDF Audit Reports', detail: 'Internal and external audit reports, findings, and remediation plans' },
];

const realWorldCases = [
  {
    title: 'Regulatory Gap Analysis',
    description:
      'Upload a new regulation and your existing compliance policy into a Collection. Ask DocTalk to identify which requirements in the regulation are not addressed by your current policy. The AI provides cited answers from both documents, making it easy to create a remediation plan.',
  },
  {
    title: 'Audit Preparation',
    description:
      'Upload the compliance framework you are being audited against (e.g., SOC 2 Trust Services Criteria) and ask about each control requirement. DocTalk extracts the specific criteria and evidence expectations, helping you prepare documentation before the auditor arrives.',
  },
  {
    title: 'Cross-Jurisdictional Review',
    description:
      'Upload regulations from multiple jurisdictions into a Collection and compare requirements. Ask questions like "How do the data breach notification timelines differ?" to understand varying obligations across regions.',
  },
];

const securityItems = [
  { icon: Lock, title: 'AES-256 Encryption', detail: 'All documents encrypted at rest with industry-standard encryption' },
  { icon: Shield, title: 'No AI Training', detail: 'Your compliance documents are never used to train AI models' },
  { icon: FileText, title: 'GDPR Compliant', detail: 'Data export and deletion capabilities for your compliance needs' },
  { icon: CheckCircle, title: 'Account Isolation', detail: 'Each account is fully isolated — documents are only accessible to you' },
];

const steps = [
  { icon: Upload, step: '1', title: 'Upload Compliance Documents', description: 'Upload regulations, policies, frameworks, or audit reports as PDF or DOCX files.' },
  { icon: MessageSquare, step: '2', title: 'Ask About Requirements', description: 'Type questions about specific obligations, controls, definitions, or gaps.' },
  { icon: CheckCircle, step: '3', title: 'Get Cited Answers', description: 'Receive answers with numbered citations. Click any citation to jump to the exact section in the original document.' },
];

const relatedUseCases = [
  { href: '/use-cases/lawyers', icon: Scale, title: 'Legal', body: 'Review contracts, court filings, and legal documents' },
  { href: '/use-cases/finance', icon: TrendingUp, title: 'Finance', body: 'Analyze financial reports and SEC filings' },
  { href: '/use-cases/healthcare', icon: Heart, title: 'Healthcare', body: 'Review clinical research and compliance documents' },
];

const faqItems = [
  {
    question: 'Can DocTalk analyze regulatory documents?',
    answer:
      'Yes. Upload regulatory texts, guidelines, or standards as PDF or DOCX files and ask questions like "What are the data retention requirements?", "What penalties apply for non-compliance?", or "Summarize the reporting obligations." DocTalk extracts the relevant provisions with numbered citations to the exact section.',
  },
  {
    question: 'Does it support cross-document analysis?',
    answer:
      'Yes. Use Collections to group related documents — such as a regulation, your internal policy, and an audit report. Then ask questions that span all documents, like "Does our internal policy cover all requirements in the regulation?" The AI cites the specific document and passage for each point.',
  },
  {
    question: 'Can it analyze SEC filings and financial regulations?',
    answer:
      'Yes. DocTalk can analyze SEC filings (10-K, 10-Q, 8-K), banking regulations, insurance compliance documents, and other financial regulatory texts. Upload the document and ask specific questions about requirements, deadlines, or definitions. Each answer includes citations to the source text.',
  },
  {
    question: 'Is there an audit trail for compliance reviews?',
    answer:
      'DocTalk preserves the full conversation history for each document session, including all questions asked and answers with their citations. Plus and Pro plan users can export these conversations. This provides a record of what was reviewed and what the AI found, though it is not a formal audit system.',
  },
  {
    question: 'What pricing works for compliance teams?',
    answer:
      'DocTalk offers individual plans: Free (300 credits/month), Plus ($9.99/month for 3,000 credits), and Pro ($19.99/month for 9,000 credits). Paid plans include unrestricted Pro mode for complex regulatory documents and custom instructions for specialized compliance frameworks. Team plans are on the roadmap.',
  },
];

export default function ComplianceClient() {
  return (
    <MarketingShell
      breadcrumb={[
        { label: 'Home', href: '/' },
        { label: 'Use Cases', href: '/use-cases' },
        { label: 'Compliance & Risk' },
      ]}
    >
      <EdPageHero
        icon={Shield}
        title="AI Document Analysis for Compliance and Risk Teams"
        lede="Analyze regulations, internal policies, audit reports, and compliance frameworks with AI-powered cited answers. Cross-reference documents to find gaps."
        primaryCta={{ label: 'Try Free Demo', href: '/demo' }}
      />

      <EdSection title="The Document Challenge for Compliance Teams">
        <EdProse>
          <p>
            Compliance teams live in a world of documents. Regulations, internal policies, compliance frameworks, audit reports, and vendor assessments create a dense web of requirements that must be understood, cross-referenced, and acted upon.
          </p>
          <p>
            A single regulation can run hundreds of pages. When a new regulation is enacted or an existing one is updated, compliance teams must review the full text, identify new or changed requirements, and map them to existing internal controls — a process that can take weeks.
          </p>
          <p>
            Resources like the{' '}
            <a href="https://www.complianceweek.com/" target="_blank" rel="noopener noreferrer">Compliance Week</a>
            {' '}report on how regulatory complexity continues to grow across industries, increasing the document review burden for compliance professionals.
          </p>
          <p>
            DocTalk accelerates this process by letting you ask natural language questions about any compliance document and receive answers with exact citations. Cross-document analysis through Collections enables gap analysis between regulations and internal policies.
          </p>
        </EdProse>
      </EdSection>

      <EdSection alt title="How DocTalk Helps Compliance Teams">
        <EdFeatureList
          items={features.map((f) => ({ title: f.title, body: f.description, icon: f.icon }))}
        />
      </EdSection>

      <EdSection title="Supported Compliance Document Types">
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          DocTalk works with the document formats used in compliance and risk management. See{' '}
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

      <EdSection alt title="Real-World Compliance Use Cases">
        {realWorldCases.map((item, i) => (
          <div key={item.title} style={i > 0 ? { marginTop: '40px' } : undefined}>
            <h3 className="ed-h3">{item.title}</h3>
            <EdProse className="mt-3">
              <p>{item.description}</p>
            </EdProse>
          </div>
        ))}
      </EdSection>

      <EdSection title="Example Questions for Compliance Documents">
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          Upload any compliance document and try questions like these. Every answer includes citations you can click to jump to the original text.
        </p>
        <EdCardGrid
          columns={2}
          items={exampleQuestions.map((q) => ({ title: q }))}
        />
      </EdSection>

      <EdSection alt title="Security for Compliance Documents">
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          Compliance documents often contain sensitive internal information. DocTalk is built with security as a priority.
        </p>
        <EdCardGrid
          columns={2}
          items={securityItems.map((s) => ({ title: s.title, body: s.detail, icon: s.icon }))}
        />
      </EdSection>

      <EdSection title="Get Started in 3 Steps">
        <EdStepRow
          steps={steps.map((s) => ({ title: s.title, body: s.description, icon: s.icon }))}
        />
      </EdSection>

      <EdSection alt title="Related Use Cases">
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

      <EdSection title="Frequently Asked Questions">
        <EdFaqList items={faqItems} />
      </EdSection>

      <EdCtaBanner
        title="Ready to streamline compliance document review?"
        description="Upload a regulation, policy, or audit report and see how AI-powered cited answers can accelerate your compliance workflow. No credit card required."
        primary={{ label: 'Try Free Demo', href: '/demo' }}
      />
    </MarketingShell>
  );
}
