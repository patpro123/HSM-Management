import React, { useState, useEffect } from 'react';
import './LandingPage.css';

interface LandingPageProps {
    onLogin: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isDark, setIsDark] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [bookingStatus, setBookingStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [bookingError, setBookingError] = useState('');

    // Handle scroll detection for navbar
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Handle dark mode initialization from localStorage
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            setIsDark(true);
        }
    }, []);

    const toggleTheme = () => {
        const newTheme = !isDark;
        setIsDark(newTheme);
        localStorage.setItem('theme', newTheme ? 'dark' : 'light');
    };

    const handleOpenModal = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsModalOpen(true);
        document.body.style.overflow = 'hidden';
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        document.body.style.overflow = '';
        // Reset booking status on close
        setTimeout(() => setBookingStatus('idle'), 300);
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBookingStatus('loading');
        setBookingError('');

        const form = e.target as HTMLFormElement;
        const payload = {
            name: (form.elements.namedItem('name') as HTMLInputElement).value,
            address: (form.elements.namedItem('address') as HTMLInputElement).value,
            phone: (form.elements.namedItem('phone') as HTMLInputElement).value,
            email: (form.elements.namedItem('email') as HTMLInputElement).value,
            instrument: (form.elements.namedItem('instrument') as HTMLSelectElement).value,
            source: (form.elements.namedItem('source') as HTMLSelectElement).value
        };

        try {
            const res = await fetch('http://localhost:3000/api/prospects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setBookingStatus('success');
                setTimeout(() => {
                    handleCloseModal();
                }, 2000);
            } else {
                const data = await res.json();
                setBookingStatus('error');
                setBookingError(data.error || 'Failed to book trial.');
            }
        } catch (err) {
            setBookingStatus('error');
            setBookingError('Network error occurred.');
        }
    };

    const getImagePath = (instrument: string) => {
        return isDark ? `/assets/${instrument}_dark.png` : `/assets/${instrument}.png`;
    };

    return (
        <div className={`landing-wrapper ${isDark ? 'dark-theme' : ''}`}>
            {/* Navbar */}
            <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`} id="navbar">
                <div className="nav-container">
                    <a href="#" className="logo">
                        <img
                            src="/HSM_Logo_Horizontal.png"
                            alt="HSM Logo"
                            className={isDark ? "logo-screen" : "logo-multiply"}
                            style={{ height: '120px', width: 'auto', marginTop: '-25px', marginBottom: '-25px', marginLeft: '-15px' }}
                        />
                    </a>

                    <div className="nav-links">
                        <a href="#curriculum">Curriculum</a>
                        <a href="#faculty">Our Instructors</a>
                        <a href="#success">Success</a>
                    </div>

                    <div className="nav-actions">
                        <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle Dark Mode">
                            {isDark ? '☀' : '☾'}
                        </button>
                        <button
                            onClick={onLogin}
                            className="btn btn-outline"
                            style={{ padding: '0.5rem 1rem', border: '1px solid var(--text-muted)' }}
                        >
                            Sign In
                        </button>
                        <button onClick={handleOpenModal} className="btn btn-cta ml-3">
                            Schedule a Trial Lesson
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main Stacking Container */}
            <main className="stacking-container">
                {/* Hero Section */}
                <section className="stack-section hero" id="home">
                    <div className="container hero-content">
                        <div className="hero-text fade-up">
                            <span className="section-label">Welcome home, musicians!</span>
                            <h1 className="hero-title serif-heading">
                                Discover Your True <br />
                                <em>Musical Voice</em>.
                            </h1>
                            <p className="hero-subtitle">
                                From eager beginners to advanced artists, HSM offers a nurturing environment to perfect your
                                craft with world-renowned instructors.
                            </p>
                            <div className="hero-cta">
                                <button onClick={handleOpenModal} className="btn btn-primary btn-large glow-shadow">
                                    Start Your Music Journey
                                </button>
                                <a href="#curriculum" className="btn btn-secondary btn-large">
                                    Explore Programs
                                </a>
                            </div>
                        </div>
                        <div className="hero-visual fade-in">
                            <div className="motif-circle motif-hero-accent"></div>
                            <img src={getImagePath('piano')} alt="Piano" className="hero-image pop-shadow" />
                        </div>
                    </div>
                </section>

                {/* Social Proof (Logos) - Stacking Section 2 */}
                <section className="stack-section logos-section">
                    <div className="container center-content">
                        <span className="section-label" style={{ marginBottom: '1rem' }}>Our students go on to attend</span>
                        <div className="trust-logos">
                            <div className="trust-logo">Trinity College London</div>
                            <div className="trust-logo">Berklee College of Music</div>
                            <div className="trust-logo">Royal Academy</div>
                            <div className="trust-logo">Juilliard School</div>
                        </div>
                    </div>
                </section>

                {/* Unlocking Learning Potential (Curriculum) - Stacking Section 3 */}
                <section className="stack-section content-split" id="curriculum">
                    <div className="container split-layout">
                        <div className="split-visual">
                            <div className="motif-circle motif-image-accent"></div>
                            <img src={getImagePath('guitar')} alt="Acoustic Guitar" className="feature-image rounded-frame" />
                        </div>
                        <div className="split-text">
                            <span className="section-label">Curriculum built for you</span>
                            <h2 className="section-title serif-heading">Unlocking Learning Potential</h2>
                            <p className="body-text">
                                Every student is unique. We tailor our private and group lessons to your specific goals,
                                ensuring you build unshakeable fundamentals while playing the music you love.
                            </p>
                            <ul className="benefit-list">
                                <li>Personalized 1-on-1 instruction</li>
                                <li>Interactive group performance labs</li>
                                <li>Bi-annual showcase recitals</li>
                            </ul>
                            <button onClick={handleOpenModal} className="btn btn-secondary mt-4">
                                Take Private Lessons
                            </button>
                        </div>
                    </div>
                </section>

                {/* Nurturing Artistic Talent (Faculty) - Stacking Section 4 */}
                <section className="stack-section content-split alternate" id="faculty">
                    <div className="container split-layout">
                        <div className="split-text">
                            <span className="section-label">Learn from the best</span>
                            <h2 className="section-title serif-heading">Nurturing Their Artistic Talent</h2>
                            <p className="body-text">
                                Our instructors aren't just teachers; they are active touring musicians, recording artists, and
                                symphony players who bring real-world experience into the classroom.
                            </p>
                            <a href="#curriculum" className="btn btn-secondary mt-4">
                                Meet Our Instructors
                            </a>
                        </div>
                        <div className="split-visual relative">
                            <div className="motif-circle motif-image-accent-2"></div>
                            <img src={getImagePath('vocals')} alt="Vocal Mic" className="feature-image rounded-frame" />

                            {/* Floating abstract UI element to look cool */}
                            <div className="floating-badge pop-shadow">
                                <span className="cursive-accent text-orange">15+</span> Dedicated Maestros
                            </div>
                        </div>
                    </div>
                </section>

                {/* Power of Perseverance (Group / Drums) - Stacking Section 5 */}
                <section className="stack-section content-split" id="success">
                    <div className="container split-layout">
                        <div className="split-visual">
                            <div className="motif-circle motif-image-accent"></div>
                            <img src={getImagePath('drums')} alt="Drums" className="feature-image rounded-frame" />
                        </div>
                        <div className="split-text">
                            <span className="section-label">Master the rhythm</span>
                            <h2 className="section-title serif-heading">The Power of Perseverance</h2>
                            <p className="body-text">
                                Learning music builds grit and determination. Join our ensemble and band programs to learn how
                                to collaborate, listen, and persevere as a team.
                            </p>
                            <button onClick={handleOpenModal} className="btn btn-secondary mt-4">
                                Take Group Lessons
                            </button>
                        </div>
                    </div>
                </section>

                {/* CTA Launch Point / Footer */}
                <section className="stack-section footer-section" id="trial">
                    <div className="footer-cta container">
                        <div className="cta-box pop-shadow">
                            <div className="motif-circle motif-cta"></div>
                            <span className="section-label text-white">Your stage awaits</span>
                            <h2 className="serif-heading text-white">Begin your musical journey today.</h2>
                            <p className="text-white body-text mb-4 text-center">
                                Join hundreds of students discovering their passion at HSM.
                            </p>
                            <button onClick={handleOpenModal} className="btn btn-cta btn-large pulse-animation">
                                Schedule a Free Trial
                            </button>
                        </div>
                    </div>

                    <footer className="real-footer">
                        <div className="container footer-grid">
                            <div>
                                <img
                                    src="/HSM_Logo_Horizontal.png"
                                    alt="HSM Logo"
                                    className="logo-screen"
                                    style={{ height: '160px', marginTop: '-40px', marginBottom: '0', marginLeft: '-20px' }}
                                />
                                <p className="text-muted">Hyderabad School of Music. Shaping the artists of tomorrow.</p>
                            </div>
                            <div className="footer-links">
                                <h4>Explore</h4>
                                <a href="#curriculum">Curriculum</a>
                                <a href="#faculty">Faculty</a>
                                <a href="#success">Ensembles</a>
                            </div>
                            <div className="footer-links">
                                <h4>Connect</h4>
                                <a href="#contact">Contact Us</a>
                                <button onClick={handleOpenModal} style={{ background: 'none', border: 'none', color: 'inherit', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', display: 'block', marginBottom: '0.75rem' }} className="hover:text-white transition-colors">Enrollment</button>
                                <a href="#careers">Careers</a>
                            </div>
                        </div>
                    </footer>
                </section>
            </main>

            {/* Trial Modal Backdrop & Content */}
            <div
                className={`modal-overlay ${isModalOpen ? 'active' : ''}`}
                id="trialModal"
                onClick={(e) => {
                    if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
                        handleCloseModal();
                    }
                }}
            >
                <div className="modal-content pop-shadow">
                    <button className="modal-close" id="closeModal" onClick={handleCloseModal}>&times;</button>
                    <span className="section-label text-center" style={{ fontSize: '1.5rem', marginBottom: '-10px' }}>
                        Let's get started
                    </span>
                    <h3 className="serif-heading text-center" style={{ fontSize: '2rem', marginBottom: '2rem' }}>
                        Book a Free Demo Class
                    </h3>

                    <form id="trialForm" className="trial-form" onSubmit={handleFormSubmit}>
                        <div className="form-group">
                            <label htmlFor="name">Full Name</label>
                            <input type="text" id="name" required placeholder="e.g. Aditi Sharma" />
                        </div>

                        <div className="form-group">
                            <label htmlFor="address">Address</label>
                            <input type="text" id="address" required placeholder="Your full address" />
                        </div>

                        <div className="form-grid">
                            <div className="form-group">
                                <label htmlFor="phone">Phone Number</label>
                                <input type="tel" id="phone" required placeholder="+91" />
                            </div>
                            <div className="form-group">
                                <label htmlFor="email">Email Address</label>
                                <input type="email" id="email" required placeholder="you@example.com" />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="instrument">Instrument Interested In</label>
                            <select id="instrument" required defaultValue="">
                                <option value="" disabled>Select an instrument...</option>
                                <option value="piano">Piano & Keyboard</option>
                                <option value="guitar">Acoustic & Electric Guitar</option>
                                <option value="vocals">Vocals (Hindustani/Carnatic/Western)</option>
                                <option value="drums">Drums & Percussion</option>
                                <option value="production">Music Production</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="source">Where did you hear about HSM?</label>
                            <select id="source" required defaultValue="">
                                <option value="" disabled>Select an option...</option>
                                <option value="google">Google Search</option>
                                <option value="social">Social Media (Instagram, Facebook)</option>
                                <option value="friend">Friend or Family</option>
                                <option value="other">Other</option>
                            </select>
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
        </div>
    );
};

export default LandingPage;
