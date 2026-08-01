import type { Metadata } from 'next';
import PageShell from '@/components/PageShell/PageShell';
import BookDemoButton from '@/components/PageShell/BookDemoButton';
import MethodologyInfographic from '@/components/LandingPage/MethodologyInfographic';
import HSMMethodSection from '@/components/LandingPage/HSMMethodSection';

export const metadata: Metadata = {
  title: 'The HSM Practice Portal | Habit Tracker & Homework Reviewer',
  description: 'How HSM\'s practice portal works: daily habit tracking, homework review, and monthly Trinity-grade assessment — the system that runs between classes.',
  alternates: { canonical: 'https://hsm.org.in/practice-portal' },
  openGraph: {
    title: 'The HSM Practice Portal | Habit Tracker & Homework Reviewer',
    description: 'The system that runs between classes — daily habit tracking, homework review, and monthly assessment.',
    url: 'https://hsm.org.in/practice-portal',
  },
};

const SCREENSHOT_SLOTS = [
  { label: 'Streak view', desc: 'What a student sees when they log daily practice — the current streak, and how many days this term.' },
  { label: 'Teacher feedback', desc: 'Audio/video notes a teacher leaves on a submitted practice recording.' },
  { label: 'Monthly grade', desc: 'Where a student stands on the Trinity Grade 1–8 path, updated after each monthly assessment.' },
];

export default function PracticePortalPage() {
  return (
    <PageShell>
      <section style={{ paddingTop: '140px', paddingBottom: '2rem' }}>
        <div className="container section-padding">
          <span className="section-label">The HSM Practice Portal</span>
          <h1 className="serif-heading" style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', maxWidth: '22ch' }}>
            The system that runs between classes.
          </h1>
          <p className="body-text" style={{ maxWidth: '62ch', fontSize: '1.05rem', margin: '1rem 0 2rem' }}>
            Every HSM student gets access to the same practice portal — teachers assign homework, students
            log daily practice and record themselves, teachers review and give feedback, and every month
            a formal assessment shows exactly where a student stands. It&apos;s the reason a once-a-week class
            turns into consistent progress.
          </p>
          <BookDemoButton />
        </div>
      </section>

      {/* Screenshot placeholders — real product images to be added once available. */}
      <section style={{ background: 'var(--bg-secondary)', padding: '3rem 0' }}>
        <div className="container section-padding" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <h2 className="section-title serif-heading" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>
            What it looks like
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
            {SCREENSHOT_SLOTS.map(slot => (
              <div
                key={slot.label}
                style={{
                  border: '1.5px dashed #cbd5e1', borderRadius: 14, padding: '1.5rem',
                  background: '#fff', minHeight: 180, display: 'flex', flexDirection: 'column',
                  justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: '0.5rem',
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>🖼️</span>
                <strong style={{ fontSize: '0.95rem' }}>{slot.label}</strong>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>{slot.desc}</p>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Screenshot coming soon
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MethodologyInfographic />
      <HSMMethodSection />

      <section style={{ padding: '3rem 0', textAlign: 'center' }}>
        <div className="container section-padding" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <h2 className="section-title serif-heading" style={{ fontSize: '1.5rem' }}>See it in your child&apos;s first class</h2>
          <p className="body-text" style={{ color: 'var(--text-muted)', maxWidth: '50ch', margin: '0.5rem auto 1.5rem' }}>
            Every new student gets a portal login from day one. Book a free demo to see how it works.
          </p>
          <BookDemoButton />
        </div>
      </section>
    </PageShell>
  );
}
