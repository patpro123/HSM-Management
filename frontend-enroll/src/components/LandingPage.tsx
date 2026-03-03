import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config';
import './LandingPage.css';

interface LandingPageProps {
    onLogin: () => void;
    authError?: string;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLogin, authError }) => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isDark, setIsDark] = useState(false);
    const [bookingStatus, setBookingStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [bookingError, setBookingError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [prefilledInstrument, setPrefilledInstrument] = useState('');
    const [prefilledSource, setPrefilledSource] = useState('');
    const [teachers, setTeachers] = useState<any[]>([]);
    const [batches, setBatches] = useState<any[]>([]);
    const [testimonialIndex, setTestimonialIndex] = useState(0);
    const [activeFaq, setActiveFaq] = useState<number | null>(null);
    const instrumentGridRef = useRef<HTMLDivElement>(null);
    const teachersGridRef = useRef<HTMLDivElement>(null);

    const faqs = [
        { q: "Does my child need prior experience?", a: "Not at all. We start from the very beginning and move at your child's pace." },
        { q: "What age groups do you teach?", a: "We welcome students from age 5 to 60+. Music has no age limit." },
        { q: "Are online classes available?", a: "Yes — all 8 instruments are available online and in-person at our Kismatpur centre." },
        { q: "How soon will my child play a real song?", a: "Most students play their first song within 4–6 weeks. We make early wins a priority." },
        { q: "What is the monthly fee?", a: "Classes start from ₹2000/month. Your first demo class is completely free." },
        { q: "What if we need to pause or stop?", a: "No problem. We have a flexible pause policy — life happens and we understand." }
    ];

    // Replace these with real reviews copy-pasted from your Google Business profile
    const testimonials = [
        { quote: "My daughter went from complete beginner to performing on stage in just 6 months. The teachers at HSM are incredibly patient.", author: "Priya M.", role: "Parent of Tabla student", initials: "PM", color: "#4285F4" },
        { quote: "The best music school in Hyderabad. The facilities are top-notch and the curriculum is very structured.", author: "Rahul S.", role: "Adult Piano student", initials: "RS", color: "#EA4335" },
        { quote: "My son looks forward to his guitar class every week. The community events have built his confidence so much!", author: "Anita K.", role: "Parent of Guitar student", initials: "AK", color: "#34A853" },
        { quote: "Learning Hindustani vocals online has been seamless. The audio quality and teacher attention is exactly like being in person.", author: "Vikram R.", role: "Online Vocal student", initials: "VR", color: "#FBBC04" },
        { quote: "I thought I was too old to learn the drums. HSM proved me wrong. Fantastic instructors who know how to teach adults.", author: "Sanjay D.", role: "Adult Drum student", initials: "SD", color: "#9C27B0" },
    ];

    // Handle scroll detection for navbar
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Parse UTM source from URL
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const source = urlParams.get('utm_source');
        if (source) {
            setPrefilledSource(source);
        }
    }, []);

    // Handle dark mode initialization from localStorage
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            setIsDark(true);
        }
    }, []);

    // Fetch teachers for Section 5
    useEffect(() => {
        const fetchTeachers = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/teachers`);
                if (res.ok) {
                    const data = await res.json();
                    setTeachers(data.teachers.slice(0, 4));
                } else {
                    throw new Error('Failed to fetch teachers');
                }
            } catch (err) {
                console.error("Failed to fetch teachers for landing page:", err);
                setTeachers([
                    { id: 1, name: 'Ravi Kumar', specialty: 'Guitar · Drums', experience: '8 years teaching', quote: '"Every student has music inside them — I just help bring it out."' },
                    { id: 2, name: 'Anjali Desai', specialty: 'Hindustani Vocals', experience: '12 years teaching', quote: '"Your voice is an instrument that only you can play."' },
                    { id: 3, name: 'David Smith', specialty: 'Piano · Keyboard', experience: '15 years teaching', quote: '"Consistency is the key to unlocking your musical potential."' },
                    { id: 4, name: 'Megha Sharma', specialty: 'Violin', experience: '6 years teaching', quote: '"Let the music guide your strings."' }
                ]);
            }
        };
        fetchTeachers();
    }, []);

    // Fetch batches for Section 8
    useEffect(() => {
        const fetchBatches = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/batches`);
                if (res.ok) {
                    const data = await res.json();
                    setBatches(data.batches.slice(0, 5));
                } else {
                    throw new Error('Failed to fetch batches');
                }
            } catch (err) {
                console.error("Failed to fetch batches for landing page:", err);
                setBatches([
                    { instrument_name: 'Guitar', days: 'Tue, Thu', timings: '5PM–8PM', age_group: 'All ages' },
                    { instrument_name: 'Tabla', days: 'Sat, Sun', timings: '10AM–1PM', age_group: '6+' },
                    { instrument_name: 'Hindustani Vocals', days: 'Tue, Thu, Sat', timings: '5PM–9PM', age_group: 'All ages' },
                    { instrument_name: 'Piano', days: 'Mon, Wed', timings: '4PM–7PM', age_group: 'All ages' }
                ]);
            }
        };
        fetchBatches();
    }, []);

    // Testimonial auto-scroll
    useEffect(() => {
        const timer = setInterval(() => {
            setTestimonialIndex(prev => (prev + 1) % testimonials.length);
        }, 4000);
        return () => clearInterval(timer);
    }, [testimonials.length]);

    // Carousel auto-scroll (instruments + teachers)
    useEffect(() => {
        const setupCarousel = (el: HTMLDivElement | null) => {
            if (!el) return () => {};
            let isInteracting = false;
            const onTouch = () => { isInteracting = true; };
            const onTouchEnd = () => { setTimeout(() => { isInteracting = false; }, 2500); };
            el.addEventListener('touchstart', onTouch, { passive: true });
            el.addEventListener('touchend', onTouchEnd, { passive: true });
            const timer = setInterval(() => {
                if (isInteracting) return;
                const cardWidth = (el.firstElementChild as HTMLElement)?.offsetWidth ?? window.innerWidth * 0.75;
                const gap = 16;
                const maxScroll = el.scrollWidth - el.clientWidth;
                const next = el.scrollLeft + cardWidth + gap;
                el.scrollTo({ left: next >= maxScroll - 10 ? 0 : next, behavior: 'smooth' });
            }, 3000);
            return () => {
                clearInterval(timer);
                el.removeEventListener('touchstart', onTouch);
                el.removeEventListener('touchend', onTouchEnd);
            };
        };
        const cleanup1 = setupCarousel(instrumentGridRef.current);
        const cleanup2 = setupCarousel(teachersGridRef.current);
        return () => { cleanup1(); cleanup2(); };
    }, []);

    const toggleTheme = () => {
        const newTheme = !isDark;
        setIsDark(newTheme);
        localStorage.setItem('theme', newTheme ? 'dark' : 'light');
    };

    const handleOpenModal = (e: React.MouseEvent, instrument?: string) => {
        e.preventDefault();
        if (instrument) {
            setPrefilledInstrument(instrument);
        } else {
            setPrefilledInstrument('');
        }
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

        try {
            const payload = {
                name: (form.elements.namedItem('name') as HTMLInputElement).value,
                phone: (form.elements.namedItem('phone') as HTMLInputElement).value,
                email: (form.elements.namedItem('email') as HTMLInputElement)?.value || '',
                instrument: (form.elements.namedItem('instrument') as HTMLSelectElement).value,
                source: (form.elements.namedItem('source') as HTMLSelectElement)?.value || ''
            };

            const res = await fetch(`${API_BASE_URL}/api/prospects`, {
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

    return (
        <div className={`landing-wrapper ${isDark ? 'dark-theme' : ''}`}>
            {authError && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '14px', color: '#991b1b', fontWeight: 500 }}>
                        {authError === 'not_provisioned'
                            ? 'Your account has not been set up yet. Please contact the school admin to get access.'
                            : 'Login failed. Please try again.'}
                    </span>
                    <button onClick={onLogin} style={{ fontSize: '13px', color: '#dc2626', fontWeight: 600, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>
                        Try again
                    </button>
                </div>
            )}
            {/* Navbar */}
            <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`} id="navbar">
                <div className="nav-container">
                    <a href="#" className="logo">
                        <img
                            src="/HSM_Logo_Horizontal.png"
                            alt="HSM Logo"
                            className={`nav-logo ${isDark ? "logo-screen" : "logo-multiply"}`}
                        />
                    </a>

                    <div className="nav-links">
                        <a href="#programs">Programs</a>
                        <a href="#teachers">Teachers</a>
                        <a href="#stories">Stories</a>
                        <a href="#schedule">Schedule</a>
                    </div>

                    <div className="nav-actions">
                        <a href="tel:+919652444188" className="nav-phone">
                            <span className="phone-icon">📱</span>
                            <span className="phone-number">+91 96524 44188</span>
                        </a>
                        <button
                            onClick={onLogin}
                            className="btn btn-outline nav-signin"
                        >
                            Sign In
                        </button>
                        <button onClick={handleOpenModal} className="btn btn-cta">
                            Book Free Class
                        </button>
                        <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle Dark Mode">
                            {isDark ? '☀' : '☾'}
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main Stacking Container */}
            <main className="stacking-container">
                {/* Hero Section */}
                <section className="stack-section hero" id="home">
                    {/* Video Background Placeholder */}
                    <div className="video-background">
                        <video autoPlay loop muted playsInline className="hero-video">
                            <source src="/hero-bg.mp4" type="video/mp4" />
                        </video>
                        <div className="video-overlay"></div>
                    </div>

                    <div className="container hero-content-new">
                        <div className="hero-text-new fade-up">
                            <h1 className="hero-title serif-heading text-white">
                                Hyderabad's Home for Music
                            </h1>
                            <p className="hero-subtitle text-white">
                                8 instruments. Expert teachers. <br />
                                Your first class is free.
                            </p>
                            <div className="hero-cta-group">
                                <button onClick={handleOpenModal} className="btn btn-primary btn-cta-main glow-shadow">
                                    Book Your Free Demo Class →
                                </button>
                                <div className="hero-secondary-row">
                                    <a
                                        href="https://wa.me/919652444188?text=Hi%20HSM%2C%20I%27d%20like%20to%20book%20a%20demo%20class"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-ghost hero-whatsapp-ghost"
                                    >
                                        💬 WhatsApp
                                    </a>
                                    <a href="#programs" className="btn btn-secondary btn-ghost">
                                        See Our Programs ↓
                                    </a>
                                </div>
                            </div>

                            <div className="trust-strip">
                                <span className="trust-item">⭐ 4.9★</span>
                                <span className="trust-divider">|</span>
                                <span className="trust-item">100+ Students</span>
                                <span className="trust-divider">|</span>
                                <span className="trust-item">8 Instruments</span>
                            </div>
                            <div className="trust-location">
                                📍 Kismatpur, Hyderabad
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section 3: Instrument Showcase */}
                <section className="stack-section instrument-showcase" id="programs">
                    <div className="container center-content section-padding">
                        <span className="section-label">Find your sound</span>
                        <h2 className="section-title serif-heading">What Would You Like to Learn?</h2>
                        <p className="body-text feature-sub text-center" style={{ marginBottom: '3rem' }}>
                            Classical Indian. Contemporary Western. Under one roof.
                        </p>

                        <div className="instrument-grid" ref={instrumentGridRef}>
                            {[
                                { id: 'keyboard', name: 'Keyboard', icon: '🎹', desc: 'Build musical foundations fast — ideal first instrument' },
                                { id: 'piano', name: 'Piano', icon: '🎹', desc: 'Classical elegance; read music, compose, perform' },
                                { id: 'guitar', name: 'Guitar', icon: '🎸', desc: 'Most popular worldwide — acoustic to electric' },
                                { id: 'drums', name: 'Drums', icon: '🥁', desc: 'Rhythm, coordination, and confidence on stage' },
                                { id: 'tabla', name: 'Tabla', icon: '🪘', desc: 'India\'s heartbeat — rhythm, tradition, discipline' },
                                { id: 'violin', name: 'Violin', icon: '🎻', desc: 'Versatile across classical, folk, and film music' },
                                { id: 'hindustani', name: 'Hindustani Vocals', icon: '🎤', desc: 'North Indian classical — raga, taal, expression' },
                                { id: 'carnatic', name: 'Carnatic Vocals', icon: '🎤', desc: 'South Indian classical — precise, devotional, powerful' }
                            ].map(inst => (
                                <div className="instrument-card pop-shadow transition-transform hover:-translate-y-2" key={inst.id}>
                                    <div className="instrument-icon">{inst.icon}</div>
                                    <h3 className="instrument-name">{inst.name}</h3>
                                    <p className="instrument-desc">{inst.desc}</p>
                                    <button
                                        className="btn btn-secondary btn-sm mt-auto"
                                        onClick={(e) => handleOpenModal(e, inst.id)}
                                    >
                                        Enquire
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Section 4: Why HSM */}
                <section className="stack-section why-hsm bg-white" id="why-us">
                    <div className="container section-padding">
                        <div className="text-center mb-5">
                            <span className="section-label">The HSM Difference</span>
                            <h2 className="section-title serif-heading">Why families choose HSM</h2>
                        </div>
                        <div className="value-props-grid">
                            <div className="value-card pop-shadow">
                                <h3 className="value-title"><span className="value-emoji">🎓</span> Expert Teachers</h3>
                                <p className="value-desc">10+ faculty trained at leading music conservatories</p>
                            </div>
                            <div className="value-card pop-shadow">
                                <h3 className="value-title"><span className="value-emoji">🎵</span> 8 Instruments</h3>
                                <p className="value-desc">India's most complete music school offering classical + western</p>
                            </div>
                            <div className="value-card pop-shadow">
                                <h3 className="value-title"><span className="value-emoji">🆓</span> First Class Free</h3>
                                <p className="value-desc">No commitment. No credit card. Just music.</p>
                            </div>
                            <div className="value-card pop-shadow">
                                <h3 className="value-title"><span className="value-emoji">🏡</span> Community-First</h3>
                                <p className="value-desc">Bi-annual recitals, workshops & events in Hyderabad</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section 5: Meet Our Teachers */}
                <section className="stack-section teachers-section" id="teachers">
                    <div className="container section-padding">
                        <div className="text-center mb-5">
                            <span className="section-label">Learn from working musicians</span>
                            <h2 className="section-title serif-heading">Our teachers are performers first,<br />educators always.</h2>
                        </div>
                        <div className="teachers-grid mt-4" ref={teachersGridRef}>
                            {teachers.length > 0 ? teachers.map((teacher, idx) => (
                                <div className="teacher-card pop-shadow" key={teacher.id || idx}>
                                    <div className="teacher-photo-wrapper">
                                        <div className="teacher-photo-placeholder">
                                            {teacher.name.charAt(0)}
                                        </div>
                                    </div>
                                    <h3 className="teacher-name">{teacher.name}</h3>
                                    <p className="teacher-specialty text-orange">{teacher.specialty || 'Instructor'}</p>
                                    <p className="teacher-exp text-muted">{teacher.experience || 'Experienced Educator'}</p>
                                    <p className="teacher-quote">
                                        {teacher.quote || '"Music is life itself."'}
                                    </p>
                                </div>
                            )) : (
                                <p className="text-center w-full">Loading teachers...</p>
                            )}
                        </div>
                        <div className="text-center mt-5">
                            <a href="#schedule" className="btn btn-outline">See All Teachers →</a>
                        </div>
                    </div>
                </section>

                {/* Section 6: Student Testimonials */}
                <section className="stack-section testimonials-section bg-secondary" id="stories">
                    <div className="container section-padding text-center">
                        <span className="section-label">What our families say</span>
                        <h2 className="section-title serif-heading mb-5">Stories from the HSM community</h2>

                        <div className="testimonial-carousel pop-shadow bg-white mx-auto relative cursor-pointer"
                            onClick={() => setTestimonialIndex(prev => (prev + 1) % testimonials.length)}>
                            <div className="testimonial-content fade-in" key={testimonialIndex}>
                                <div className="reviewer-header">
                                    <div className="reviewer-initials" style={{ background: testimonials[testimonialIndex].color }}>
                                        {testimonials[testimonialIndex].initials}
                                    </div>
                                    <div className="reviewer-info">
                                        <p className="testimonial-author">{testimonials[testimonialIndex].author}</p>
                                        <p className="reviewer-time">{testimonials[testimonialIndex].role}</p>
                                    </div>
                                    <span className="google-g-badge" title="Google review">G</span>
                                </div>
                                <div className="testimonial-stars text-orange">★★★★★</div>
                                <p className="testimonial-quote">
                                    "{testimonials[testimonialIndex].quote}"
                                </p>
                            </div>
                            <div className="carousel-controls mt-4">
                                <button className="carousel-btn" onClick={(e) => { e.stopPropagation(); setTestimonialIndex(prev => (prev - 1 + testimonials.length) % testimonials.length); }}>&larr;</button>
                                <div className="carousel-dots">
                                    {testimonials.map((_, idx) => (
                                        <span key={idx} className={`dot ${idx === testimonialIndex ? 'active' : ''}`}
                                            onClick={(e) => { e.stopPropagation(); setTestimonialIndex(idx); }}></span>
                                    ))}
                                </div>
                                <button className="carousel-btn" onClick={(e) => { e.stopPropagation(); setTestimonialIndex(prev => (prev + 1) % testimonials.length); }}>&rarr;</button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section 7: Alumni / Aspiration */}
                <section className="stack-section logos-section">
                    <div className="container center-content section-padding">
                        <span className="section-label" style={{ marginBottom: '1rem' }}>Our students go on to achieve great things</span>
                        <div className="trust-logos mb-5">
                            <div className="trust-logo">Trinity College London</div>
                            <div className="trust-logo">Berklee College of Music</div>
                            <div className="trust-logo">Royal Academy</div>
                            <div className="trust-logo">Juilliard School</div>
                        </div>

                        <div className="alumni-grid mt-5">
                            <div className="alumni-card pop-shadow">
                                <div className="alumni-photo bg-secondary"></div>
                                <div className="alumni-info">
                                    <h4>A*** S.</h4>
                                    <p className="text-muted">Grade 8 Piano, Trinity</p>
                                </div>
                            </div>
                            <div className="alumni-card pop-shadow">
                                <div className="alumni-photo bg-secondary"></div>
                                <div className="alumni-info">
                                    <h4>V*** R.</h4>
                                    <p className="text-muted">Lead Guitar, Local Band</p>
                                </div>
                            </div>
                            <div className="alumni-card pop-shadow">
                                <div className="alumni-photo bg-secondary"></div>
                                <div className="alumni-info">
                                    <h4>M*** K.</h4>
                                    <p className="text-muted">Berklee Summer Program</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section 8: Schedule Outline */}
                <section className="stack-section schedule-section bg-secondary" id="schedule">
                    <div className="container section-padding">
                        <div className="text-center mb-5">
                            <span className="section-label">Find your perfect slot</span>
                            <h2 className="section-title serif-heading">Class Schedule Overview</h2>
                        </div>

                        <div className="schedule-table-container pop-shadow bg-white">
                            <div className="schedule-badge">Online classes available for all instruments 🌐</div>
                            <table className="schedule-table">
                                <thead>
                                    <tr>
                                        <th>Instrument</th>
                                        <th>Days</th>
                                        <th>Timings</th>
                                        <th>Age Group</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {batches.length > 0 ? batches.map((b, i) => (
                                        <tr key={i}>
                                            <td><strong>{b.instrument_name}</strong></td>
                                            <td>{b.days || b.day_of_week}</td>
                                            <td>{b.timings || `${b.start_time}-${b.end_time}`}</td>
                                            <td>{b.age_group || 'All ages'}</td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={4} className="text-center">Loading schedule...</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="text-center mt-5">
                            <button onClick={handleOpenModal} className="btn btn-primary">Book your slot →</button>
                        </div>
                    </div>
                </section>

                {/* Section 9: FAQ */}
                <section className="stack-section faq-section bg-white" id="faq">
                    <div className="container section-padding">
                        <div className="text-center mb-5">
                            <span className="section-label">You asked, we answered</span>
                            <h2 className="section-title serif-heading">Frequently Asked Questions</h2>
                        </div>

                        <div className="faq-accordion max-w-3xl mx-auto">
                            {faqs.map((faq, idx) => (
                                <div className="faq-item" key={idx}>
                                    <button
                                        className="faq-question"
                                        onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                                    >
                                        {faq.q}
                                        <span className={`faq-icon ${activeFaq === idx ? 'open' : ''}`}>+</span>
                                    </button>
                                    <div className={`faq-answer ${activeFaq === idx ? 'open' : ''}`}>
                                        <p>{faq.a}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Section 10: Location + Contact */}
                <section className="stack-section location-section" id="contact">
                    <div className="container split-layout">
                        <div className="split-visual location-map rounded-frame pop-shadow overflow-hidden">
                            <iframe
                                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3808.6657904092683!2d78.38466631536767!3d17.37984898808339!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bcb9500095817a1%3A0xe6bfdd6b7e8ed599!2sHyderabad%20School%20of%20Music!5e0!3m2!1sen!2sin!4v1709211019685!5m2!1sen!2sin"
                                width="100%"
                                height="100%"
                                style={{ border: 0, minHeight: '400px' }}
                                allowFullScreen={false}
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade">
                            </iframe>
                        </div>
                        <div className="split-text location-info">
                            <span className="section-label">Find us here</span>
                            <h2 className="section-title serif-heading">Come visit us in Kismatpur</h2>
                            <div className="contact-details mt-4">
                                <div className="contact-item mb-4">
                                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>📍 Address</h4>
                                    <p className="text-muted leading-relaxed" style={{ marginLeft: '1.75rem', marginTop: '0.5rem' }}>
                                        Flat No 1, 3rd Floor, House No 7-214<br />
                                        Abhyudaya Nagar, Kishan Nagar Colony<br />
                                        Bandlaguda Jagir-Kismatpura<br />
                                        Hyderabad — 500086<br />
                                        <em style={{ fontSize: '0.85rem' }}>(Opposite Kritunga Restaurant)</em>
                                    </p>
                                </div>
                                <div className="contact-item mb-5">
                                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>📱 Phone</h4>
                                    <p className="text-muted" style={{ marginLeft: '1.75rem', marginTop: '0.5rem', fontWeight: 600 }}>
                                        +91 96524 44188
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', marginLeft: '1.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                                    <a href="https://wa.me/919652444188?text=Hi%20HSM%2C%20I%27d%20like%20to%20book%20a%20demo%20class" target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ backgroundColor: '#25D366', color: 'white', border: 'none' }}>WhatsApp us now →</a>
                                    <a href="tel:+919652444188" className="btn btn-secondary">Call us →</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section 11: Footer CTA */}
                <section className="stack-section footer-section" id="trial">
                    <div className="footer-cta container">
                        <div className="cta-box pop-shadow">
                            <div className="motif-circle motif-cta"></div>
                            <span className="section-label text-white">Your stage awaits</span>
                            <h2 className="serif-heading text-white">Your first class is free.<br />No strings attached.</h2>
                            <p className="text-white body-text mb-4 text-center">
                                Limited demo slots available each week.
                            </p>
                            <button onClick={handleOpenModal} className="btn btn-cta btn-large pulse-animation">
                                Book Your Free Demo Now →
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
        </div>
    );
};

export default LandingPage;
