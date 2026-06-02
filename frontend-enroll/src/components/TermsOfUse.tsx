import React, { useEffect } from 'react';

interface Props {
  onClose: () => void;
}

const TermsOfUse: React.FC<Props> = ({ onClose }) => {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900">Terms of Use</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-8 py-6 text-sm text-slate-700 space-y-5 leading-relaxed">
          <p className="text-xs text-slate-400">Effective date: June 2026</p>

          <section>
            <h3 className="font-semibold text-slate-900 mb-1">1. Proprietary Content</h3>
            <p>
              All content on this website and in any HSM documents — including curriculum materials,
              lesson plans, course structures, sheet music, recordings, faculty profiles, images, and
              written materials — is the exclusive property of Hyderabad School of Music and is
              protected under the Indian Copyright Act, 1957, and applicable international copyright
              treaties. Unauthorised reproduction or use of any content is strictly prohibited.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900 mb-1">2. Permitted Use</h3>
            <p>
              Content on this site is provided for informational purposes related to HSM's programs.
              Enrolled students may access course materials solely for personal, non-commercial
              educational use. Any other use requires prior written consent from HSM.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900 mb-1">3. Prohibited Activities</h3>
            <p>You may not, without HSM's prior written permission:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>Reproduce, copy, distribute, or republish any HSM content</li>
              <li>Sell, sublicense, or commercially exploit any content</li>
              <li>Modify, adapt, or create derivative works from any HSM materials</li>
              <li>Use any content in a way that misrepresents HSM or its programs</li>
            </ul>
            <p className="mt-2">Violation of these terms may result in legal action under applicable law.</p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900 mb-1">4. User Accounts</h3>
            <p>
              The HSM portal is for authorised users only. Account credentials are personal and
              non-transferable. You are responsible for maintaining the confidentiality of your
              credentials and for all activity that occurs under your account.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900 mb-1">5. Enrollment and Payments</h3>
            <p>
              Enrollment in HSM programs is subject to availability and HSM's admissions process.
              Fees paid are subject to HSM's refund policy as communicated at the time of enrollment.
              HSM reserves the right to modify program offerings, schedules, and fees with reasonable
              notice.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900 mb-1">6. Privacy</h3>
            <p>
              HSM collects limited personal information to manage enrollments and communicate with
              students and families. We do not sell or share personal data with third parties for
              commercial purposes. Data is stored securely and used solely for the administration of
              HSM's programs.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900 mb-1">7. Changes to These Terms</h3>
            <p>
              HSM may update these Terms of Use at any time. The effective date at the top of this
              page will reflect the most recent revision. Continued use of the website or portal after
              changes are posted constitutes your acceptance of the revised terms.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900 mb-1">8. Governing Law</h3>
            <p>
              These Terms are governed by the laws of India. Any disputes arising out of or in
              connection with these Terms shall be subject to the exclusive jurisdiction of the courts
              in Hyderabad, Telangana.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900 mb-1">9. Contact</h3>
            <p>
              For permissions, queries, or concerns regarding these Terms, please contact us at{' '}
              <a href="mailto:admin@hsm.org.in" className="text-orange-600 hover:underline">
                admin@hsm.org.in
              </a>.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">
            © 2024–2028 Hyderabad School of Music. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TermsOfUse;
