import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'Sign In | DocTalk' },
  description: 'Sign in to DocTalk with Google, Microsoft, or a secure email magic link.',
  alternates: {
    canonical: '/auth',
  },
  robots: { index: false, follow: false },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
