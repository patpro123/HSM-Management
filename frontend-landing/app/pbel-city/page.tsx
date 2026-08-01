import type { Metadata } from 'next';
import PageShell from '@/components/PageShell/PageShell';
import BookDemoButton from '@/components/PageShell/BookDemoButton';

export const metadata: Metadata = {
  title: 'Vocal Classes in PBEL City, Hyderabad | HSM',
  description: 'Hyderabad School of Music now teaches Hindustani and Carnatic vocals in PBEL City. More instruments coming soon. Free demo class.',
  alternates: { canonical: 'https://hsm.org.in/pbel-city' },
  openGraph: {
    title: 'Vocal Classes in PBEL City, Hyderabad | HSM',
    description: 'HSM now teaches Hindustani and Carnatic vocals in PBEL City. More instruments coming soon.',
    url: 'https://hsm.org.in/pbel-city',
  },
};

export default function PbelCityPage() {
  return (
    <PageShell prefilledInstrument="Hindustani Classical">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': ['LocalBusiness', 'MusicSchool'],
            name: 'Hyderabad School of Music — PBEL City',
            url: 'https://hsm.org.in/pbel-city',
            address: {
              '@type': 'PostalAddress',
              addressLocality: 'PBEL City, Hyderabad',
              addressRegion: 'Telangana',
              addressCountry: 'IN',
            },
            description: 'Hindustani and Carnatic vocal classes, with more instruments planned.',
          }),
        }}
      />

      <section style={{ paddingTop: '140px', paddingBottom: '2rem' }}>
        <div className="container section-padding">
          <span className="section-label">🎉 New campus · PBEL City, Hyderabad</span>
          <h1 className="serif-heading" style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', maxWidth: '20ch' }}>
            Vocal classes are now open in PBEL City.
          </h1>
          <p className="body-text" style={{ maxWidth: '60ch', fontSize: '1.05rem', margin: '1rem 0 1rem' }}>
            Hindustani Classical and Carnatic Classical vocal training is running now at HSM&apos;s new PBEL City
            campus — the same daily habit-tracking and teacher-review system used at our Kismatpur campus,
            closer to home if you&apos;re in PBEL City.
          </p>
          <p className="body-text" style={{ maxWidth: '60ch', color: 'var(--text-muted)', fontSize: '0.95rem', margin: '0 0 2rem' }}>
            Guitar, Keyboard, Piano, Drums, and other instruments are coming soon to this campus.
            In the meantime they&apos;re available at our <a href="/kismatpur" style={{ color: 'var(--brand-orange)' }}>Kismatpur campus</a>.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <BookDemoButton prefilledInstrument="Hindustani Classical" />
            <a
              href="https://wa.me/919652444188?text=Hi%20HSM%2C%20I%27d%20like%20to%20know%20more%20about%20PBEL%20City%20classes"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-ghost"
            >
              💬 WhatsApp for exact venue &amp; timing
            </a>
          </div>
        </div>
      </section>

      <section style={{ background: 'var(--bg-secondary)', padding: '3rem 0' }}>
        <div className="container section-padding" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <h2 className="section-title serif-heading" style={{ fontSize: '1.75rem' }}>What&apos;s available now</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '1rem' }}>
            <a
              href="/hindustani-classical-classes-hyderabad"
              style={{ padding: '0.5rem 1rem', borderRadius: 999, background: '#fff', color: 'var(--text-heading)', fontSize: '0.9rem', textDecoration: 'none', fontWeight: 600 }}
            >
              🎤 Hindustani Classical
            </a>
            <a
              href="/carnatic-classical-classes-hyderabad"
              style={{ padding: '0.5rem 1rem', borderRadius: 999, background: '#fff', color: 'var(--text-heading)', fontSize: '0.9rem', textDecoration: 'none', fontWeight: 600 }}
            >
              🎤 Carnatic Classical
            </a>
          </div>
          <p className="body-text" style={{ color: 'var(--text-muted)', marginTop: '1.5rem', fontSize: '0.9rem' }}>
            This is a new, growing campus — message us on WhatsApp for the exact venue address and current batch timings.
          </p>
        </div>
      </section>
    </PageShell>
  );
}
