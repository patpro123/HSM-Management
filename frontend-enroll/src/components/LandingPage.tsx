import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import './LandingPage.css';
import Navbar from './LandingPage/Navbar';
import HeroSection from './LandingPage/HeroSection';
import InstrumentShowcase from './LandingPage/InstrumentShowcase';
import WhyHSM from './LandingPage/WhyHSM';
import TeachersSection from './LandingPage/TeachersSection';
import TestimonialsSection from './LandingPage/TestimonialsSection';
import AlumniSection from './LandingPage/AlumniSection';
import ScheduleSection from './LandingPage/ScheduleSection';
import FaqSection from './LandingPage/FaqSection';
import LocationSection from './LandingPage/LocationSection';
import FooterCTA from './LandingPage/FooterCTA';

interface LandingPageProps {
    onLogin: () => void;
    authError?: string;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLogin, authError }) => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isDark, setIsDark] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [prefilledInstrument, setPrefilledInstrument] = useState('');
    const [prefilledSource, setPrefilledSource] = useState('');
    const [teachers, setTeachers] = useState<any[]>([]);
    const [batches, setBatches] = useState<any[]>([]);
    const [testimonialIndex, setTestimonialIndex] = useState(0);
    const [activeFaq, setActiveFaq] = useState<number | null>(null);

    const faqs = [
        { q: "Does my child need prior experience?", a: "Not at all. We start from the very beginning and move at your child's pace." },
        { q: "What age groups do you teach?", a: "We welcome students from age 5 to 60+. Music has no age limit." },
        { q: "Are online classes available?", a: "Yes — all 8 instruments are available online and in-person at our Kismatpur centre." },
        { q: "How soon will my child play a real song?", a: "Most students play their first song within 4–6 weeks. We make early wins a priority." },
        { q: "What is the monthly fee?", a: "Classes start from ₹2000/month. Your first demo class is completely free." },
        { q: "What if we need to pause or stop?", a: "No problem. We have a flexible pause policy — life happens and we understand." }
    ];

    const testimonials = [
        { quote: "My daughter went from complete beginner to performing on stage in just 6 months. The teachers at HSM are incredibly patient.", author: "Priya M.", role: "Parent of Tabla student", initials: "PM", color: "#4285F4" },
        { quote: "The best music school in Hyderabad. The facilities are top-notch and the curriculum is very structured.", author: "Rahul S.", role: "Adult Piano student", initials: "RS", color: "#EA4335" },
        { quote: "My son looks forward to his guitar class every week. The community events have built his confidence so much!", author: "Anita K.", role: "Parent of Guitar student", initials: "AK", color: "#34A853" },
        { quote: "Learning Hindustani vocals online has been seamless. The audio quality and teacher attention is exactly like being in person.", author: "Vikram R.", role: "Online Vocal student", initials: "VR", color: "#FBBC04" },
        { quote: "I thought I was too old to learn the drums. HSM proved me wrong. Fantastic instructors who know how to teach adults.", author: "Sanjay D.", role: "Adult Drum student", initials: "SD", color: "#9C27B0" },
    ];

    useEffect(() => {
        const handleScroll = () => { setIsScrolled(window.scrollY > 50); };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const source = urlParams.get('utm_source');
        if (source) setPrefilledSource(source);
    }, []);

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') setIsDark(true);
    }, []);

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

    useEffect(() => {
        const timer = setInterval(() => {
            setTestimonialIndex(prev => (prev + 1) % testimonials.length);
        }, 4000);
        return () => clearInterval(timer);
    }, [testimonials.length]);

    const toggleTheme = () => {
        const newTheme = !isDark;
        setIsDark(newTheme);
        localStorage.setItem('theme', newTheme ? 'dark' : 'light');
    };

    const handleOpenModal = (e: React.MouseEvent, instrument?: string) => {
        e.preventDefault();
        setPrefilledInstrument(instrument || '');
        setIsModalOpen(true);
        document.body.style.overflow = 'hidden';
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        document.body.style.overflow = '';
    };

    // Listen for success/close messages from the intake iframe
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.data?.type === 'hsm-intake-success' || event.data?.type === 'hsm-intake-close') {
                handleCloseModal();
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

            <Navbar
                isScrolled={isScrolled}
                isDark={isDark}
                onLogin={onLogin}
                onOpenModal={handleOpenModal}
                onToggleTheme={toggleTheme}
            />

            <main className="stacking-container">
                <HeroSection onOpenModal={handleOpenModal} />
                <InstrumentShowcase onOpenModal={handleOpenModal} />
                <WhyHSM />
                <TeachersSection teachers={teachers} />
                <TestimonialsSection
                    testimonials={testimonials}
                    testimonialIndex={testimonialIndex}
                    onNext={() => setTestimonialIndex(prev => (prev + 1) % testimonials.length)}
                    onPrev={() => setTestimonialIndex(prev => (prev - 1 + testimonials.length) % testimonials.length)}
                    onSetIndex={setTestimonialIndex}
                />
                <AlumniSection />
                <ScheduleSection batches={batches} onOpenModal={handleOpenModal} />
                <FaqSection
                    faqs={faqs}
                    activeFaq={activeFaq}
                    onToggle={(idx) => setActiveFaq(activeFaq === idx ? null : idx)}
                />
                <LocationSection />
                <FooterCTA onOpenModal={handleOpenModal} />
            </main>

            {/* Intake form — rendered in an iframe so the landing page stays mounted */}
            {isModalOpen && (
                <div
                    className="modal-overlay active"
                    onClick={e => { if ((e.target as HTMLElement).classList.contains('modal-overlay')) handleCloseModal(); }}
                    style={{ alignItems: 'center', justifyContent: 'center', display: 'flex' }}
                >
                    <div style={{ position: 'relative', width: '92%', maxWidth: 680, height: '92vh', borderRadius: 24, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.25)' }}>
                        <button
                            onClick={handleCloseModal}
                            className="modal-close"
                            style={{ zIndex: 10 }}
                            aria-label="Close"
                        >
                            &times;
                        </button>
                        <iframe
                            src={`/intake?embed=1${prefilledInstrument ? `&instrument=${encodeURIComponent(prefilledInstrument)}` : ''}`}
                            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                            title="Book a Free Demo"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default LandingPage;
