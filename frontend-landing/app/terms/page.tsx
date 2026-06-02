import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Terms of Use | Hyderabad School of Music',
    description: 'Terms of Use for the Hyderabad School of Music website and student portal.',
    robots: { index: true, follow: true },
    alternates: { canonical: 'https://hsm.org.in/terms' },
};

export default function TermsOfUsePage() {
    return (
        <main style={{ maxWidth: '720px', margin: '0 auto', padding: '3rem 1.5rem 5rem', fontFamily: 'var(--loaded-jakarta, sans-serif)', color: '#1e293b', lineHeight: '1.7' }}>
            <Link href="/" style={{ fontSize: '0.875rem', color: '#ea580c', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginBottom: '2rem' }}>
                ← Back to Home
            </Link>

            <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>Terms of Use</h1>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '2.5rem' }}>Effective date: June 2026</p>

            <Section title="1. Proprietary Content">
                <p>
                    All content on this website and in any HSM documents — including curriculum materials,
                    lesson plans, course structures, sheet music, recordings, faculty profiles, images, and
                    written materials — is the exclusive property of Hyderabad School of Music and is
                    protected under the Indian Copyright Act, 1957, and applicable international copyright
                    treaties. Unauthorised reproduction or use of any content is strictly prohibited.
                </p>
            </Section>

            <Section title="2. Permitted Use">
                <p>
                    Content on this site is provided for informational purposes related to HSM&apos;s programs.
                    Enrolled students may access course materials solely for personal, non-commercial
                    educational use. Any other use requires prior written consent from HSM.
                </p>
            </Section>

            <Section title="3. Prohibited Activities">
                <p>You may not, without HSM&apos;s prior written permission:</p>
                <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
                    <li>Reproduce, copy, distribute, or republish any HSM content</li>
                    <li>Sell, sublicense, or commercially exploit any content</li>
                    <li>Modify, adapt, or create derivative works from any HSM materials</li>
                    <li>Use any content in a way that misrepresents HSM or its programs</li>
                </ul>
                <p style={{ marginTop: '0.75rem' }}>Violation of these terms may result in legal action under applicable law.</p>
            </Section>

            <Section title="4. User Accounts">
                <p>
                    The HSM portal is for authorised users only. Account credentials are personal and
                    non-transferable. You are responsible for maintaining the confidentiality of your
                    credentials and for all activity that occurs under your account.
                </p>
            </Section>

            <Section title="5. Enrollment and Payments">
                <p>
                    Enrollment in HSM programs is subject to availability and HSM&apos;s admissions process.
                    Fees paid are subject to HSM&apos;s refund policy as communicated at the time of enrollment.
                    HSM reserves the right to modify program offerings, schedules, and fees with reasonable notice.
                </p>
            </Section>

            <Section title="6. Privacy">
                <p>
                    HSM collects limited personal information to manage enrollments and communicate with
                    students and families. We do not sell or share personal data with third parties for
                    commercial purposes. Data is stored securely and used solely for the administration of
                    HSM&apos;s programs.
                </p>
            </Section>

            <Section title="7. Changes to These Terms">
                <p>
                    HSM may update these Terms of Use at any time. The effective date at the top of this
                    page will reflect the most recent revision. Continued use of the website or portal after
                    changes are posted constitutes your acceptance of the revised terms.
                </p>
            </Section>

            <Section title="8. Governing Law">
                <p>
                    These Terms are governed by the laws of India. Any disputes arising out of or in
                    connection with these Terms shall be subject to the exclusive jurisdiction of the courts
                    in Hyderabad, Telangana.
                </p>
            </Section>

            <Section title="9. Contact">
                <p>
                    For permissions, queries, or concerns regarding these Terms, please contact us at{' '}
                    <a href="mailto:admin@hsm.org.in" style={{ color: '#ea580c' }}>
                        admin@hsm.org.in
                    </a>.
                </p>
            </Section>

            <footer style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center' }}>
                © 2024–2028 Hyderabad School of Music. All rights reserved.
            </footer>
        </main>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem', color: '#0f172a' }}>{title}</h2>
            <div style={{ fontSize: '0.95rem', color: '#334155' }}>{children}</div>
        </section>
    );
}
