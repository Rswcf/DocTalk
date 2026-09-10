import type { Metadata } from 'next';
import HrContractsContent from './HrContractsContent';
import HrContractsJsonLd from './HrContractsJsonLd';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'AI Contract & HR Document Review Tool',
  description:
    'Review employment contracts, HR policies, and company handbooks with AI. Get instant answers about specific clauses with source citations.',
  path: '/use-cases/hr-contracts',
  localized: true,
  keywords: ['hr contract ai', 'employment document analysis', 'hr document review ai'],
  openGraph: {
    title: 'AI Contract & HR Document Review Tool | DocTalk',
    description:
      'Review employment contracts, HR policies, and company handbooks with AI. Get instant answers about specific clauses with source citations. Try free.',
  },
});

export default function HrContractsPage() {
  return (
    <>
      <HrContractsJsonLd locale="en" />
      <HrContractsContent locale="en" />
    </>
  );
}
