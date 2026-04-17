import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import './LandingPage.css';
import { PublicCleffChat } from './Chat/PublicCleffChat';
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
        { q: "Are online classes available?", a: "All our classes are in-person at our Kismatpur centre — we believe music is best learnt together." },
        { q: "How soon will my child play a real song?", a: "Most students play their first song within 4–6 weeks. We make early wins a priority." },
        { q: "What are the fees?", a: "We offer a Trial Pack (4 classes, starting ₹2000) and a Quarterly Pack (24 classes). Your first demo class is completely free — no commitment." },
        { q: "What if we need to pause or stop?", a: "No problem. We have a flexible pause policy — life happens and we understand." }
    ];

    const testimonials = [
        { quote: "I recently started learning guitar at HSM near Bandlaguda and I'm really happy! The teachers are outstanding — they break down concepts from the very basics, making learning easy and enjoyable. Visit and speak with the team — you'll immediately sense their dedication and passion for teaching.", author: "Kishore Gandhi", role: "Guitar student", initials: "KG", color: "#4285F4" },
        { quote: "I was looking for drum classes for my son and, after a bit of searching, decided to visit Hyderabad School of Music because it was nearby. From the moment I walked in, I was thrilled by the lively activities and the welcoming atmosphere. The staff is not only talented but also incredibly friendly, creating a perfect environment for learning and creativity. My son is now learning drums here and making amazing progress, thanks to the patient and skilled instructors. My wife has also joined for advanced Hindustani music lessons, and she's just as impressed with the quality of teaching and the dedication of the faculty.", author: "Bharath Raj Kuttikad", role: "Parent", initials: "BK", color: "#34A853" },
        { quote: "My son is learning guitar in HSM from past 3 months. I am really happy with my decision. He is getting practical teaching lessons from good teachers who are very friendly. The HSM members have a lot of interest in music and take good care of the students. Recently, the members organized a musical event involving all age groups which was awesome. It was a good exposure for the students.", author: "Yodesh Shaw", role: "Parent of Guitar student", initials: "YS", color: "#EA4335" },
        { quote: "Nestled in the heart of our community, Hyderabad School Of Music (HSM) is a beacon of musical excellence. From the moment you step through the door, you're greeted with a warm atmosphere and a sense of belonging. I've had the pleasure of experiencing music education in various settings, and HSM stands out for its unwavering commitment to nurturing talent and fostering a love for music in students of all ages.", author: "Jayasudha Venkatesh", role: "Student", initials: "JV", color: "#9C27B0" },
        { quote: "Enrolled my kid for keyboard. He is enjoying the learning. Good facilities, sir pays attention to each student which is good. Would definitely recommend.", author: "B Srinivasu", role: "Parent of Keyboard student", initials: "BS", color: "#FBBC04" },
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
                    setTeachers(data.teachers);
                } else {
                    throw new Error('Failed to fetch teachers');
                }
            } catch (err) {
                console.error("Failed to fetch teachers for landing page:", err);
                setTeachers([
                    { id: 1, name: 'Josva', specialty: 'Keyboard · Guitar' },
                    { id: 2, name: 'David', specialty: 'Piano' },
                    { id: 3, name: 'Subroto Bhaduri', specialty: 'Drums · Tabla · Octopad' },
                    { id: 4, name: 'Issac Lawrence', specialty: 'Violin' },
                    { id: 5, name: 'Sangeeta', specialty: 'Hindustani Classical · Carnatic Classical' },
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
                    setBatches(data.batches);
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

            {/* Public Cleff chatbot — no auth required */}
            <PublicCleffChat onBookDemo={() => handleOpenModal({ preventDefault: () => {} } as React.MouseEvent)} />

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
