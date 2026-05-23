"use client";

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useLocale } from '../../i18n';
import MarketingShell from '../../components/marketing/MarketingShell';
import EdPageHero from '../../components/marketing/EdPageHero';
import EdSection from '../../components/marketing/EdSection';

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

/* ---------- editorial style helpers ---------- */

const panelStyle: CSSProperties = {
  border: '1px solid var(--ed-rule)',
  background: 'var(--ed-paper-2)',
  borderRadius: '3px',
  padding: '24px',
};

const fieldStyle: CSSProperties = {
  border: '1px solid var(--ed-rule)',
  background: 'var(--ed-paper)',
  color: 'var(--ed-ink)',
  borderRadius: '3px',
  padding: '10px 12px',
  fontSize: '14px',
  lineHeight: 1.6,
  fontFamily: 'var(--dt-body)',
  outline: 'none',
  width: '100%',
};

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
    <MarketingShell
      breadcrumb={[
        { label: 'Home', href: '/' },
        { label: t('contact.eyebrow') },
      ]}
    >
      <EdPageHero
        eyebrow={t('contact.eyebrow')}
        title={t('contact.headline')}
        lede={t('contact.description')}
      />

      <EdSection>
        <div style={panelStyle}>
          <div style={{ marginBottom: '24px' }}>
            <h2 className="ed-h2">{tOr('contact.form.title', 'Send us a message')}</h2>
            <p className="ed-body" style={{ marginTop: '10px' }}>
              {tOr(
                'contact.form.subtitle',
                'We read every message. Typical response time: 1–2 business days.'
              )}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col" style={{ gap: '20px' }} noValidate>
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

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="contact-name" className="ed-label" style={{ display: 'block', marginBottom: '8px' }}>
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
                  style={{ ...fieldStyle, opacity: isBusy ? 0.6 : 1 }}
                />
              </div>

              <div>
                <label htmlFor="contact-email" className="ed-label" style={{ display: 'block', marginBottom: '8px' }}>
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
                  style={{ ...fieldStyle, opacity: isBusy ? 0.6 : 1 }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="contact-message" className="ed-label" style={{ display: 'block', marginBottom: '8px' }}>
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
                className="resize-y"
                style={{ ...fieldStyle, opacity: isBusy ? 0.6 : 1 }}
              />
              <p className="ed-caption" style={{ marginTop: '8px' }}>
                {tOr('contact.form.messageHint', 'Minimum 10 characters. Markdown is not rendered.')}
              </p>
            </div>

            <div className="flex items-center flex-wrap" style={{ gap: '16px', marginTop: '4px' }}>
              <button
                type="submit"
                disabled={isBusy}
                className="ed-cta disabled:cursor-not-allowed"
                style={{ opacity: isBusy ? 0.6 : 1 }}
              >
                {isBusy
                  ? tOr('contact.form.submitting', 'Sending…')
                  : tOr('contact.form.submit', 'Send message')}
              </button>
              {state === 'success' && (
                <p
                  className="ed-body"
                  role="status"
                  style={{ color: 'var(--ed-signal)', fontWeight: 500 }}
                >
                  {tOr('contact.form.success', 'Thanks — your message is on its way. We will reply to the email you provided.')}
                </p>
              )}
              {state === 'error' && (
                <p
                  className="ed-body"
                  role="alert"
                  style={{ color: 'var(--ed-signal)', fontWeight: 500 }}
                >
                  {errorText || tOr('contact.form.error', 'Something went wrong. Please try again or email support@doctalk.site directly.')}
                </p>
              )}
            </div>
          </form>
        </div>
      </EdSection>

      <EdSection alt label={t('contact.primary.title')}>
        <p className="ed-body" style={{ maxWidth: '660px' }}>
          {t('contact.primary.emailLabel')}{' '}
          <a href="mailto:support@doctalk.site" className="ed-link">
            support@doctalk.site
          </a>
        </p>
      </EdSection>

      <EdSection title={t('contact.when.title')}>
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <div className="ed-label">{t('contact.when.goodReasons.title')}</div>
            <div className="ed-prose" style={{ marginTop: '16px' }}>
              <ul>
                <li>{t('contact.when.goodReasons.item1')}</li>
                <li>{t('contact.when.goodReasons.item2')}</li>
                <li>{t('contact.when.goodReasons.item3')}</li>
                <li>{t('contact.when.goodReasons.item4')}</li>
              </ul>
            </div>
          </div>
          <div>
            <div className="ed-label">{t('contact.when.beforeYouSend.title')}</div>
            <div className="ed-prose" style={{ marginTop: '16px' }}>
              <ul>
                <li>{t('contact.when.beforeYouSend.item1')}</li>
                <li>{t('contact.when.beforeYouSend.item2')}</li>
                <li>{t('contact.when.beforeYouSend.item3')}</li>
                <li>{t('contact.when.beforeYouSend.item4')}</li>
              </ul>
            </div>
          </div>
        </div>
      </EdSection>
    </MarketingShell>
  );
}
