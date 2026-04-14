"use client";

import { useState } from 'react';
import { useLocale } from '../../i18n';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

export default function ContactPageClient() {
  const { t, tOr } = useLocale();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');  // honeypot
  const [state, setState] = useState<SubmitState>('idle');
  const [errorText, setErrorText] = useState<string>('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('submitting');
    setErrorText('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message, website }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorText(data.error ?? 'Could not send message.');
        setState('error');
        return;
      }
      setState('success');
      setName('');
      setEmail('');
      setMessage('');
    } catch {
      setErrorText('Network error. Please try again.');
      setState('error');
    }
  }

  const isBusy = state === 'submitting';

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main id="main-content" className="flex-1 px-6 py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          <section className="space-y-4">
            <p className="text-sm font-medium tracking-[0.18em] uppercase text-zinc-500 dark:text-zinc-300">
              {t('contact.eyebrow')}
            </p>
            <h1 className="font-serif text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {t('contact.headline')}
            </h1>
            <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-300">
              {t('contact.description')}
            </p>
          </section>

          <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                {tOr('contact.form.title', 'Send us a message')}
              </h2>
              <p className="mt-2 text-sm leading-7 text-zinc-500 dark:text-zinc-300">
                {tOr(
                  'contact.form.subtitle',
                  'We read every message. Typical response time: 1–2 business days.'
                )}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Honeypot: visually hidden but focusable by bots parsing the DOM. */}
              <div aria-hidden="true" className="absolute left-[-9999px] w-px h-px overflow-hidden">
                <label htmlFor="contact-website">Website</label>
                <input
                  id="contact-website"
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="contact-name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                    {tOr('contact.form.nameLabel', 'Name (optional)')}
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isBusy}
                    autoComplete="name"
                    maxLength={120}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
                  />
                </div>

                <div>
                  <label htmlFor="contact-email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                    {tOr('contact.form.emailLabel', 'Email')} *
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isBusy}
                    autoComplete="email"
                    maxLength={254}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="contact-message" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                  {tOr('contact.form.messageLabel', 'Message')} *
                </label>
                <textarea
                  id="contact-message"
                  required
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={isBusy}
                  minLength={10}
                  maxLength={5000}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60 resize-y"
                />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {tOr('contact.form.messageHint', 'Minimum 10 characters. Markdown is not rendered.')}
                </p>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <button
                  type="submit"
                  disabled={isBusy}
                  className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isBusy
                    ? tOr('contact.form.submitting', 'Sending…')
                    : tOr('contact.form.submit', 'Send message')}
                </button>
                {state === 'success' && (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">
                    {tOr('contact.form.success', 'Thanks — your message is on its way. We will reply to the email you provided.')}
                  </p>
                )}
                {state === 'error' && (
                  <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                    {errorText || tOr('contact.form.error', 'Something went wrong. Please try again or email support@doctalk.site directly.')}
                  </p>
                )}
              </div>
            </form>
          </section>

          <section className="rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 p-6">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {t('contact.primary.title')}
            </h2>
            <p className="mt-3 text-base leading-7 text-zinc-600 dark:text-zinc-300">
              {t('contact.primary.emailLabel')}{' '}
              <a
                href="mailto:support@doctalk.site"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                support@doctalk.site
              </a>
            </p>
          </section>

          <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {t('contact.when.title')}
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">
                  {t('contact.when.goodReasons.title')}
                </h3>
                <ul className="mt-3 space-y-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                  <li>{t('contact.when.goodReasons.item1')}</li>
                  <li>{t('contact.when.goodReasons.item2')}</li>
                  <li>{t('contact.when.goodReasons.item3')}</li>
                  <li>{t('contact.when.goodReasons.item4')}</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">
                  {t('contact.when.beforeYouSend.title')}
                </h3>
                <ul className="mt-3 space-y-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                  <li>{t('contact.when.beforeYouSend.item1')}</li>
                  <li>{t('contact.when.beforeYouSend.item2')}</li>
                  <li>{t('contact.when.beforeYouSend.item3')}</li>
                  <li>{t('contact.when.beforeYouSend.item4')}</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
