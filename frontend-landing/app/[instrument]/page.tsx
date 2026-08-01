import type { Metadata } from 'next';
import type { StaticImageData } from 'next/image';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { INSTRUMENTS, getInstrumentBySlug } from '@/lib/instruments';
import { getBatches } from '@/lib/data';
import { getInstrumentSchedule, getInstrumentTeacherNames, dayLabel } from '@/lib/schedule';
import { getTeacherDisplayName } from '@/lib/teacherProfiles';
import PageShell from '@/components/PageShell/PageShell';
import BookDemoButton from '@/components/PageShell/BookDemoButton';
import FaqAccordion from '@/components/PageShell/FaqAccordion';
import guitarPhoto from './guitar.webp';
import baseGuitarPhoto from './base_guitar.webp';
import keyboardPhoto from './keyboard.webp';
import pianoPhoto from './piano.webp';
import drumsPhoto from './drums.webp';
import vocalsPhoto from './vocals.webp';
import octopadPhoto from './octopad.jpeg';
import violinPhoto from './violin.jpg';

interface InstrumentImages {
  main: StaticImageData;
  accent?: StaticImageData;
  accentAlt?: string;
}

// Only instruments we have real photos for get one — the rest fall back to
// a large icon tile rather than forcing in a mismatched stock image.
const INSTRUMENT_IMAGES: Partial<Record<string, InstrumentImages>> = {
  guitar: { main: guitarPhoto },
  bass_guitar: { main: baseGuitarPhoto },
  keyboard: { main: keyboardPhoto },
  piano: { main: pianoPhoto },
  drums: { main: drumsPhoto },
  octopad: { main: octopadPhoto },
  violin: { main: violinPhoto },
  tabla: { main: vocalsPhoto },
  hindustani: { main: vocalsPhoto },
  carnatic: { main: vocalsPhoto },
};

export function generateStaticParams() {
  return INSTRUMENTS.map(i => ({ instrument: i.slug }));
}

export const dynamicParams = false;

interface PageProps {
  params: Promise<{ instrument: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { instrument: slug } = await params;
  const instrument = getInstrumentBySlug(slug);
  if (!instrument) return {};

  const title = `${instrument.name} Classes in Kismatpur, Hyderabad | HSM`;
  const description = `Learn ${instrument.name} at Hyderabad School of Music, Kismatpur. ${instrument.desc}. Trinity College London graded syllabus, ensemble sessions, free demo class.`;

  return {
    title,
    description,
    alternates: { canonical: `https://hsm.org.in/${instrument.slug}` },
    openGraph: { title, description, url: `https://hsm.org.in/${instrument.slug}` },
  };
}

const GENERIC_FAQS = [
  { q: 'Does my child need prior experience?', a: 'Not at all. We start from the very beginning and move at your own pace.' },
  { q: 'What age groups do you teach?', a: 'We welcome students from age 5 to 60+. Music has no age limit.' },
  { q: 'What are the fees?', a: 'We offer a Trial Pack (4 classes, starting ₹2000) and a Quarterly Pack (24 classes). Your first demo class is completely free — no commitment.' },
];

export default async function InstrumentPage({ params }: PageProps) {
  const { instrument: slug } = await params;
  const instrument = getInstrumentBySlug(slug);
  if (!instrument) notFound();

  const batches = await getBatches();
  const schedule = getInstrumentSchedule(batches, instrument.dbNames);
  const teacherNames = getInstrumentTeacherNames(batches, instrument.dbNames).map(getTeacherDisplayName);

  const faqs = [
    {
      q: `How soon will my child play a real ${instrument.name.toLowerCase()} piece?`,
      a: 'Most students play their first recognisable piece within 4–6 weeks. We make early wins a priority.',
    },
    ...GENERIC_FAQS,
  ];

  const images = INSTRUMENT_IMAGES[instrument.id];

  return (
    <PageShell prefilledInstrument={instrument.name}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Course',
            name: `${instrument.name} Classes`,
            description: instrument.longDesc,
            provider: {
              '@type': 'MusicSchool',
              name: 'Hyderabad School of Music',
              url: 'https://hsm.org.in',
              sameAs: 'https://hsm.org.in',
            },
            hasCourseInstance: {
              '@type': 'CourseInstance',
              courseMode: 'Onsite',
              location: {
                '@type': 'Place',
                name: 'Hyderabad School of Music — Kismatpur',
                address: 'Kismatpur, Hyderabad, Telangana',
              },
            },
          }),
        }}
      />

      <section style={{ paddingTop: '140px', paddingBottom: '2rem' }}>
        <div className="container section-padding">
          <div className="instrument-hero-grid">
            <div>
              <span className="section-label">{instrument.name} · Kismatpur, Hyderabad</span>
              <h1 className="serif-heading" style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', maxWidth: '18ch' }}>
                {instrument.name} Classes in Hyderabad
              </h1>
              <p className="body-text" style={{ maxWidth: '60ch', fontSize: '1.05rem', margin: '1rem 0 2rem' }}>
                {instrument.longDesc}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                <BookDemoButton prefilledInstrument={instrument.name} />
                <a
                  href="https://wa.me/919652444188?text=Hi%20HSM%2C%20I%27d%20like%20to%20know%20more%20about%20classes"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-ghost"
                >
                  💬 WhatsApp us
                </a>
              </div>
            </div>

            <div className="instrument-hero-media">
              {images ? (
                <>
                  <div className="instrument-hero-photo">
                    <Image
                      src={images.main}
                      alt={`${instrument.name} classes at Hyderabad School of Music`}
                      fill
                      sizes="(max-width: 900px) 100vw, 480px"
                      style={{ objectFit: 'cover' }}
                      priority
                    />
                  </div>
                  {images.accent && (
                    <div className="instrument-hero-accent">
                      <Image
                        src={images.accent}
                        alt={images.accentAlt || `${instrument.name} at Hyderabad School of Music`}
                        fill
                        sizes="220px"
                        style={{ objectFit: 'cover' }}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="instrument-hero-fallback">
                  <span className="instrument-hero-fallback-icon">{instrument.icon}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section style={{ background: 'var(--bg-secondary)', padding: '3rem 0' }}>
        <div className="container section-padding" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <h2 className="section-title serif-heading" style={{ fontSize: '1.75rem' }}>Schedule</h2>
          {schedule.length > 0 ? (
            <div className="pop-shadow" style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Day</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Time</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Teacher</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((slot, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{dayLabel(slot.day)}</td>
                      <td style={{ padding: '10px 12px' }}>{slot.time}</td>
                      <td style={{ padding: '10px 12px' }}>{slot.teacherName ? getTeacherDisplayName(slot.teacherName) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="body-text" style={{ color: 'var(--text-muted)' }}>
              {instrument.name} batches are opening up as demand grows — message us on WhatsApp for the current timing options.
            </p>
          )}
        </div>
      </section>

      {teacherNames.length > 0 && (
        <section style={{ padding: '3rem 0' }}>
          <div className="container section-padding" style={{ paddingTop: 0, paddingBottom: 0 }}>
            <h2 className="section-title serif-heading" style={{ fontSize: '1.75rem' }}>Taught by</h2>
            <p className="body-text">
              {teacherNames.join(', ')} — working musicians who teach {instrument.name.toLowerCase()} at HSM.
              See full faculty profiles on the <a href="/#teachers" style={{ color: 'var(--brand-orange)' }}>homepage</a>.
            </p>
          </div>
        </section>
      )}

      <section style={{ padding: '3rem 0 4rem' }}>
        <div className="container section-padding" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <h2 className="section-title serif-heading" style={{ fontSize: '1.75rem', marginBottom: '1.25rem' }}>Frequently asked questions</h2>
          <FaqAccordion faqs={faqs} />
        </div>
      </section>
    </PageShell>
  );
}
