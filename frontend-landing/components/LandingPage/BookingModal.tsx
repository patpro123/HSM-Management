import React from 'react';

interface BookingModalProps {
  isOpen: boolean;
  bookingStatus: 'idle' | 'loading' | 'success' | 'error';
  bookingError: string;
  prefilledInstrument: string;
  prefilledSource: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  bookingStatus,
  bookingError,
  prefilledInstrument,
  prefilledSource,
  onClose,
  onSubmit,
}) => {
  return (
    <div
      className={`modal-overlay ${isOpen ? 'active' : ''}`}
      id="trialModal"
      onClick={(e) => {
        if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
          onClose();
        }
      }}
    >
      <div className="modal-content pop-shadow">
        <button className="modal-close" id="closeModal" onClick={onClose}>&times;</button>
        <span className="section-label text-center" style={{ fontSize: '1.5rem', marginBottom: '-10px' }}>
          Let's get started
        </span>
        <h3 className="serif-heading text-center" style={{ fontSize: '2rem', marginBottom: '2rem' }}>
          Book a Free Demo Class
        </h3>

        <form id="trialForm" className="trial-form" onSubmit={onSubmit}>
          <div className="form-group mb-4">
            <label htmlFor="name">Full Name *</label>
            <input type="text" id="name" required placeholder="e.g. Aditi Sharma" className="w-full" />
          </div>

          <div className="form-grid mb-4">
            <div className="form-group mb-0">
              <label htmlFor="phone">Phone Number *</label>
              <input type="tel" id="phone" required placeholder="+91" />
            </div>
            <div className="form-group mb-0">
              <label htmlFor="email">Email Address <span className="text-muted font-normal">(optional)</span></label>
              <input type="email" id="email" placeholder="you@example.com" />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="instrument">Instrument Interested In</label>
            <select id="instrument" key={prefilledInstrument} defaultValue={prefilledInstrument}>
              <option value="" disabled>Select an instrument...</option>
              <option value="piano">Piano & Keyboard</option>
              <option value="guitar">Acoustic & Electric Guitar</option>
              <option value="vocals">Vocals (Hindustani/Carnatic/Western)</option>
              <option value="drums">Drums & Percussion</option>
              <option value="tabla">Tabla</option>
              <option value="violin">Violin</option>
              <option value="keyboard">Keyboard</option>
              <option value="hindustani">Hindustani Vocals</option>
              <option value="carnatic">Carnatic Vocals</option>
              <option value="production">Music Production</option>
            </select>
          </div>

          <div className="form-group mb-4 mt-4">
            <label htmlFor="source">How did you hear about us? <span className="text-muted font-normal">(optional)</span></label>
            <select id="source" key={prefilledSource} defaultValue={prefilledSource}>
              <option value="" disabled>Select an option...</option>
              <option value="google">Google Search</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="friend">Friend or Family</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group mb-4" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}>
            <input type="checkbox" id="whatsapp_optin" defaultChecked style={{ width: 'auto', marginBottom: 0 }} />
            <label htmlFor="whatsapp_optin" style={{ marginBottom: 0, fontWeight: 'normal' }}>✓ It's ok to contact me on WhatsApp</label>
          </div>

          {bookingStatus === 'error' && (
            <div style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.5rem', textAlign: 'center' }}>
              {bookingError}
            </div>
          )}

          <button
            type="submit"
            disabled={bookingStatus === 'loading' || bookingStatus === 'success'}
            className="btn btn-cta"
            style={{
              width: '100%',
              marginTop: '1rem',
              backgroundColor: bookingStatus === 'success' ? '#10b981' : undefined,
              opacity: bookingStatus === 'loading' ? 0.7 : 1
            }}
          >
            {bookingStatus === 'success' ? 'Booking Confirmed! 🎉' :
              bookingStatus === 'loading' ? 'Submitting...' : 'Confirm Booking'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default BookingModal;
