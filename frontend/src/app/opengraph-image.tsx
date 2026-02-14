import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'DocTalk — AI Document Chat with Cited Answers';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #18181b 0%, #27272a 50%, #18181b 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          padding: '60px',
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: '#fafafa',
            marginBottom: 24,
            display: 'flex',
          }}
        >
          DocTalk
        </div>
        <div
          style={{
            fontSize: 32,
            color: '#a1a1aa',
            textAlign: 'center',
            maxWidth: 800,
            lineHeight: 1.4,
            display: 'flex',
          }}
        >
          AI Document Chat with Cited Answers
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 20,
            color: '#71717a',
            display: 'flex',
            gap: 16,
          }}
        >
          <span>PDF</span>
          <span>·</span>
          <span>DOCX</span>
          <span>·</span>
          <span>PPTX</span>
          <span>·</span>
          <span>XLSX</span>
          <span>·</span>
          <span>URL</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
