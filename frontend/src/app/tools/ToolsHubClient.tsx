"use client";

import React from 'react';
import { LetterText, Clock } from 'lucide-react';
import MarketingShell from '../../components/marketing/MarketingShell';
import EdPageHero from '../../components/marketing/EdPageHero';
import EdSection from '../../components/marketing/EdSection';
import EdCardGrid from '../../components/marketing/EdCardGrid';
import EdCheckList from '../../components/marketing/EdCheckList';
import EdRelatedLinks from '../../components/marketing/EdRelatedLinks';
import EdCtaBanner from '../../components/marketing/EdCtaBanner';

const tools = [
  {
    slug: 'word-counter',
    icon: LetterText,
    title: 'Word Counter',
    description:
      'Count words, characters, sentences, and paragraphs in any text. See reading time estimates and most frequent words.',
    meta: 'Text metrics',
  },
  {
    slug: 'reading-time',
    icon: Clock,
    title: 'Reading Time Calculator',
    description:
      'Estimate how long it takes to read or present any text. Compare slow, average, and fast reading and speaking speeds.',
    meta: 'Planning utility',
  },
];

const proofPoints = [
  'Browser-only text processing',
  'Built for document workflows',
  'Ready to hand off to AI chat',
];

export default function ToolsHubClient() {
  return (
    <MarketingShell
      breadcrumb={[
        { label: 'Home', href: '/' },
        { label: 'Tools' },
      ]}
    >
      <EdPageHero
        eyebrow="Free utilities"
        title="Document tools for quick checks before deeper AI analysis."
        lede="Count, estimate, and prepare text locally. When the work needs source-grounded answers, move the same document into DocTalk."
      />

      <EdSection>
        <EdCheckList items={proofPoints} />
      </EdSection>

      <EdSection alt title="Available tools">
        <p className="ed-lede" style={{ marginBottom: '32px' }}>
          Small utilities for repeated document prep work.
        </p>
        <EdCardGrid
          columns={2}
          items={tools.map((tool) => ({
            label: tool.meta,
            title: tool.title,
            body: tool.description,
            icon: tool.icon,
            href: `/tools/${tool.slug}`,
          }))}
        />
      </EdSection>

      <EdSection>
        <EdRelatedLinks
          links={[
            { href: '/features/multi-format', label: 'Multi-Format Support' },
            { href: '/features/citations', label: 'Citation Highlighting' },
            { href: '/use-cases/students', label: 'For Students' },
            { href: '/pricing', label: 'Pricing' },
          ]}
        />
      </EdSection>

      <EdCtaBanner
        title="Need cited answers from the original file?"
        description="Upload a PDF, DOCX, PPTX, or spreadsheet to ask questions and inspect citations in context."
        primary={{ label: 'Try the Free Demo', href: '/demo' }}
        secondary={{ label: 'Explore features', href: '/features' }}
      />
    </MarketingShell>
  );
}
