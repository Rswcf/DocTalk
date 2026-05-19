"use client";

import React from 'react';
import Link from 'next/link';
import {
  Heart,
  FileText,
  Search,
  ClipboardCheck,
  Upload,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  BookOpen,
  Scale,
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
    title: 'Review Clinical Research Papers',
    description:
      'Upload published clinical studies, systematic reviews, or meta-analyses. Ask about study design, sample size, primary endpoints, statistical significance, and conclusions. Get cited answers from the exact section of the paper.',
  },
  {
    icon: ClipboardCheck,
    title: 'Analyze Compliance Documents',
    description:
      'Upload regulatory guidelines, accreditation standards, or compliance frameworks. Ask about specific requirements, deadlines, and obligations. The AI extracts the relevant provisions with numbered citations.',
  },
  {
    icon: BookOpen,
    title: 'Extract Protocol Details',
    description:
      'Upload clinical protocols, standard operating procedures, or treatment guidelines. Ask about dosing schedules, inclusion/exclusion criteria, or procedural steps. Each answer cites the exact section.',
  },
  {
    icon: FileText,
    title: 'Review Insurance Policies',
    description:
      'Upload insurance policy documents and ask about coverage terms, exclusions, pre-authorization requirements, and appeal procedures. Get cited answers pointing to the specific policy clause.',
  },
];

const exampleQuestions = [
  'What were the primary endpoints of this clinical trial?',
  'What is the sample size and patient demographics?',
  'What adverse events were reported in this study?',
  'What are the inclusion criteria for this protocol?',
  'Summarize the compliance requirements in section 3.',
  'What does this policy exclude from coverage?',
];

const docTypes = [
  { format: 'PDF Clinical Studies', detail: 'Published research papers, clinical trial reports, and systematic reviews' },
  { format: 'PDF Compliance Documents', detail: 'Regulatory guidelines, accreditation standards, and audit reports' },
  { format: 'DOCX Protocols', detail: 'Clinical protocols, SOPs, and treatment guidelines' },
  { format: 'PDF Insurance Policies', detail: 'Coverage documents, benefits summaries, and policy amendments' },
];

const steps = [
  { icon: Upload, step: '1', title: 'Upload a Document', description: 'Upload a clinical study, compliance document, protocol, or insurance policy as PDF or DOCX.' },
  { icon: MessageSquare, step: '2', title: 'Ask Your Question', description: 'Type questions about endpoints, requirements, dosing, coverage terms, or anything in the document.' },
  { icon: CheckCircle, step: '3', title: 'Get Cited Answers', description: 'Receive answers with numbered citations. Click any citation to jump to the exact section in the original document.' },
];

const relatedUseCases = [
  { href: '/use-cases/compliance', icon: Shield, title: 'Compliance', body: 'Analyze regulatory and policy documents' },
  { href: '/use-cases/teachers', icon: BookOpen, title: 'Teachers', body: 'Review research papers and educational documents' },
  { href: '/use-cases/lawyers', icon: Scale, title: 'Legal', body: 'Review contracts, filings, and regulatory documents' },
];

const faqItems = [
  {
    question: 'Is DocTalk HIPAA compliant?',
    answer:
      'DocTalk is a general-purpose AI document analysis tool. It is not specifically HIPAA-certified and has not undergone a formal HIPAA compliance audit. We encrypt all documents with AES-256 at rest and never use documents for AI training, but we recommend against uploading documents containing Protected Health Information (PHI). DocTalk is well-suited for reviewing published research, compliance frameworks, protocols, and educational materials that do not contain individual patient data.',
  },
  {
    question: 'Does it work with medical PDFs and research papers?',
    answer:
      'Yes. DocTalk supports PDF, DOCX, PPTX, XLSX, TXT, and Markdown files. You can upload clinical research papers, systematic reviews, medical guidelines, and compliance documents. The AI reads the full document and provides answers with numbered citations pointing to the specific section, table, or paragraph.',
  },
  {
    question: 'Can it help with clinical trial analysis?',
    answer:
      'Yes. Upload a clinical trial report or published study and ask questions like "What were the primary endpoints?", "What was the sample size and demographics?", or "What adverse events were reported?" DocTalk extracts the relevant sections with citations so you can verify every detail against the source.',
  },
  {
    question: 'How does DocTalk handle security for medical documents?',
    answer:
      'All uploaded documents are encrypted with AES-256 encryption at rest. Documents are never used for AI model training. DocTalk is GDPR-compliant, provides data export and deletion capabilities, and each user account is fully isolated. However, as noted above, we recommend against uploading documents with PHI since DocTalk is not HIPAA-certified.',
  },
  {
    question: 'What pricing is available for healthcare professionals?',
    answer:
      'DocTalk offers a Free plan (300 credits/month) to get started, Plus ($9.99/month for 3,000 credits), and Pro ($19.99/month for 9,000 credits). Paid plans include unrestricted Pro mode for complex research papers. Credit packs are also available for burst usage.',
  },
];

export default function HealthcareClient() {
  return (
    <MarketingShell
      breadcrumb={[
        { label: 'Home', href: '/' },
        { label: 'Use Cases', href: '/use-cases' },
        { label: 'Healthcare' },
      ]}
    >
      <EdPageHero
        icon={Heart}
        title="AI Document Analysis for Healthcare Professionals"
        lede="Review clinical studies, compliance documents, protocols, and insurance policies with AI-powered cited answers. Verify every claim against the source."
        primaryCta={{ label: 'Try Free Demo', href: '/demo' }}
      />

      <EdSection title="Important: Not HIPAA-Certified">
        <EdProse>
          <p>
            DocTalk is a general-purpose document analysis tool. It is not HIPAA-certified and should not be used with documents containing Protected Health Information (PHI). It is ideal for reviewing published research, compliance frameworks, protocols, and educational materials.
          </p>
        </EdProse>
      </EdSection>

      <EdSection alt title="The Document Challenge in Healthcare">
        <EdProse>
          <p>
            Healthcare generates an enormous volume of documentation. Clinical studies can run hundreds of pages. Compliance frameworks are dense and cross-referential. Insurance policies contain layers of provisions, exclusions, and conditions that require careful review.
          </p>
          <p>
            Healthcare professionals need to stay current with the latest research, ensure compliance with evolving regulations, and review complex policy documents — all while managing demanding clinical or administrative workloads.
          </p>
          <p>
            Resources like{' '}
            <a href="https://pubmed.ncbi.nlm.nih.gov/" target="_blank" rel="noopener noreferrer">PubMed</a>
            {' '}index millions of biomedical articles. Keeping up with relevant literature is a constant challenge for healthcare professionals.
          </p>
          <p>
            DocTalk helps by letting you upload any document and ask natural language questions. Every answer comes with numbered citations to the exact passage, so you can verify claims against the source text in seconds.
          </p>
        </EdProse>
      </EdSection>

      <EdSection title="How DocTalk Helps Healthcare Professionals">
        <EdFeatureList
          items={features.map((f) => ({ title: f.title, body: f.description, icon: f.icon }))}
        />
      </EdSection>

      <EdSection alt title="Supported Healthcare Document Types">
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          DocTalk works with common document formats in healthcare. See{' '}
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

      <EdSection title="Example Questions for Healthcare Documents">
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          Upload any healthcare document (that does not contain PHI) and try questions like these. Every answer includes citations you can click to jump to the original text.
        </p>
        <EdCardGrid
          columns={2}
          items={exampleQuestions.map((q) => ({ title: q }))}
        />
      </EdSection>

      <EdSection alt title="Why Citations Are Critical in Healthcare">
        <EdProse>
          <p>
            In healthcare, accuracy is non-negotiable. Unlike general-purpose chatbots that may generate plausible-sounding but unsourced claims, DocTalk bases every answer on the actual text of your uploaded document. It does not rely on general medical knowledge or training data.
          </p>
          <p>
            Every answer includes numbered citations that link directly to the exact passage in the original document. When reviewing a clinical study, you can click a citation to jump to the specific table, figure, or paragraph being referenced.
          </p>
          <p>
            This is essential for evidence-based practice. You can verify that a statistical finding, dosing recommendation, or safety concern actually appears in the source document before acting on it.
          </p>
          <p>
            Learn more about how{' '}
            <Link href="/features/citations" className="ed-inline">
              citation highlighting
            </Link>
            {' '}works in DocTalk, and explore the{' '}
            <Link href="/features/performance-modes" className="ed-inline">
              Pro analysis mode
            </Link>
            {' '}for complex research papers.
          </p>
        </EdProse>
      </EdSection>

      <EdSection title="Security & Privacy">
        <EdProse>
          <p>
            DocTalk encrypts all documents with AES-256 at rest, never uses documents for AI training, and is GDPR-compliant. However, DocTalk is not HIPAA-certified — please do not upload documents containing Protected Health Information (PHI).
          </p>
          <p>
            DocTalk is ideal for: published research papers, regulatory guidelines, compliance frameworks, clinical protocols (without patient data), insurance policies, and medical educational materials.
          </p>
        </EdProse>
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
        title="Ready to accelerate your document review?"
        description="Upload a clinical study, compliance document, or protocol and see how AI-powered cited answers can help. No credit card required."
        primary={{ label: 'Try Free Demo', href: '/demo' }}
      />
    </MarketingShell>
  );
}
