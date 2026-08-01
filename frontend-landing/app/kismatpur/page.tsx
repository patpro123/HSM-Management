import type { Metadata } from 'next';
import Link from 'next/link';
import { INSTRUMENTS } from '@/lib/instruments';
import PageShell from '@/components/PageShell/PageShell';
import BookDemoButton from '@/components/PageShell/BookDemoButton';

const MAP_SRC = 'https://maps.google.com/maps?q=17.3471995,78.3909525&z=17&output=embed';

export const metadata: Metadata = {
  title: 'Music Classes in Kismatpur, Hyderabad | HSM',
  description: 'Hyderabad School of Music\'s main campus in Bandlaguda Jagir-Kismatpura — Guitar, Keyboard, Piano, Drums, Tabla, Violin, Hindustani & Carnatic Vocals. Free demo class.',
  alternates: { canonical: 'https://hsm.org.in/kismatpur' },
  openGraph: {
    title: 'Music Classes in Kismatpur, Hyderabad | HSM',
    description: 'HSM\'s main campus in Bandlaguda Jagir-Kismatpura — all instruments, one roof.',
    url: 'https://hsm.org.in/kismatpur',
  },
};

const HOURS = [
  { days: 'Tuesday – Friday', time: '5:00 PM – 9:00 PM' },
  { days: 'Saturday', time: '3:00 PM – 9:00 PM' },
  { days: 'Sunday', time: '10:00 AM – 1:00 PM  &  5:00 PM – 9:00 PM' },
  { days: 'Monday', time: 'Closed', closed: true },
];

export default function KismatpurPage() {
  return (
    <PageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': ['LocalBusiness', 'MusicSchool'],
            name: 'Hyderabad School of Music — Kismatpur',
            url: 'https://hsm.org.in/kismatpur',
            address: {
              '@type': 'PostalAddress',
              streetAddress: 'Flat No 1, 3rd Floor, House No 7-214, Abhyudaya Nagar, Kishan Nagar Colony, Bandlaguda Jagir-Kismatpura',
              addressLocality: 'Hyderabad',
              addressRegion: 'Telangana',
              postalCode: '500086',
              addressCountry: 'IN',
            },
            geo: { '@type': 'GeoCoordinates', latitude: 17.3471995, longitude: 78.3909525 },
            openingHours: ['Tu-Fr 17:00-21:00', 'Sa 15:00-21:00', 'Su 10:00-13:00,17:00-21:00'],
          }),
        }}
      />

      <section style={{ paddingTop: '140px', paddingBottom: '2rem' }}>
        <div className="container section-padding">
          <span className="section-label">Kismatpur · Hyderabad</span>
          <h1 className="serif-heading" style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', maxWidth: '20ch' }}>
            Music classes in Kismatpur — every instrument, one roof.
          </h1>
          <p className="body-text" style={{ maxWidth: '60ch', fontSize: '1.05rem', margin: '1rem 0 2rem' }}>
            HSM&apos;s main campus in Bandlaguda Jagir-Kismatpura is where it all started — Guitar, Keyboard, Piano,
            Drums, Tabla, Violin, and both Hindustani and Carnatic vocals, all taught by working musicians,
            all under one roof.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <BookDemoButton />
            <a
              href="https://wa.me/919652444188?text=Hi%20HSM%2C%20I%27d%20like%20to%20know%20more%20about%20classes%20in%20Kismatpur"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-ghost"
            >
              💬 WhatsApp us
            </a>
          </div>
        </div>
      </section>

      <section style={{ background: 'var(--bg-secondary)', padding: '3rem 0' }}>
        <div className="container split-layout">
          <div className="split-visual rounded-frame pop-shadow overflow-hidden" style={{ minHeight: 320 }}>
            <iframe
              src={MAP_SRC}
              width="100%"
              height="100%"
              style={{ border: 0, minHeight: '320px' }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <div className="split-text">
            <p className="text-muted leading-relaxed">
              <strong>📍 Address</strong><br />
              Flat No 1, 3rd Floor, House No 7-214<br />
              Abhyudaya Nagar, Kishan Nagar Colony<br />
              Bandlaguda Jagir-Kismatpura<br />
              Hyderabad — 500086<br />
              <em style={{ fontSize: '0.85rem' }}>(Opposite Kritunga Restaurant)</em>
            </p>
            <p className="text-muted" style={{ fontWeight: 700, margin: '1.5rem 0 0.5rem' }}>🕐 Opening Hours</p>
            <table className="hours-table">
              <tbody>
                {HOURS.map(({ days, time, closed }) => (
                  <tr key={days} className={closed ? 'hours-closed' : ''}>
                    <td className="hours-day">{days}</td>
                    <td className="hours-time">{time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section style={{ padding: '3rem 0' }}>
        <div className="container section-padding" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <h2 className="section-title serif-heading" style={{ fontSize: '1.75rem' }}>Instruments taught at Kismatpur</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '1rem' }}>
            {INSTRUMENTS.map(inst => (
              <Link
                key={inst.id}
                href={`/${inst.slug}`}
                style={{
                  padding: '0.5rem 1rem', borderRadius: 999, background: 'var(--bg-secondary)',
                  color: 'var(--text-heading)', fontSize: '0.9rem', textDecoration: 'none', fontWeight: 600,
                }}
              >
                {inst.icon} {inst.name}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
