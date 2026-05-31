'use client';

import React, { useState, useEffect } from 'react';
import './LandingPage.css';
import { PublicCleffChat } from './Chat/PublicCleffChat';
import Navbar from './LandingPage/Navbar';
import PromoBanner from './LandingPage/PromoBanner';
import ExitIntentModal from './LandingPage/ExitIntentModal';
import HeroSection from './LandingPage/HeroSection';
import InstrumentShowcase from './LandingPage/InstrumentShowcase';
import WhyHSM from './LandingPage/WhyHSM';
import TeachersSection from './LandingPage/TeachersSection';
import TestimonialsSection from './LandingPage/TestimonialsSection';
import AlumniSection from './LandingPage/AlumniSection';
import HSMMethodSection from './LandingPage/HSMMethodSection';
import MethodologyInfographic from './LandingPage/MethodologyInfographic';
import ScheduleSection from './LandingPage/ScheduleSection';
import FaqSection from './LandingPage/FaqSection';
import LocationSection from './LandingPage/LocationSection';
import FooterCTA from './LandingPage/FooterCTA';

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portal.hsm.org.in';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://hsm-management.onrender.com';

interface Teacher {
    id: number;
    name: string;
    specialty?: string;
    [key: string]: unknown;
}

interface Batch {
    instrument_name: string;
    [key: string]: unknown;
}

interface LandingPageProps {
    teachers: Teacher[];
    batches: Batch[];
}

const faqs = [
    { q: "How is HSM different from a regular music class?", a: "Most music schools teach students to play individually and work toward grade exams. HSM puts students into ensembles from the start — you learn to play with others, perform on stage, and build habits that make practice at home actually stick. We're building musicians, not just grading them." },
    { q: "What is the habit tracker and homework reviewer?", a: "Every student gets access to our practice portal. Teachers assign homework and students log daily practice streaks. The homework reviewer lets teachers send audio/video instructions for what to practice. Students see exactly what they need to do — and check it off when done." },
    { q: "Does my child need prior experience?", a: "Not at all. We start from the very beginning and move at your child's pace." },
    { q: "What age groups do you teach?", a: "We welcome students from age 5 to 60+. Music has no age limit." },
    { q: "How soon will my child play a real song?", a: "Most students play their first song within 4–6 weeks. We make early wins a priority." },
    { q: "What are the fees?", a: "We offer a Trial Pack (4 classes, starting ₹2000) and a Quarterly Pack (24 classes). Your first demo class is completely free — no commitment." },
];

const testimonials = [
    { quote: "I recently started learning guitar at HSM near Bandlaguda and I'm really happy! The teachers are outstanding — they break down concepts from the very basics, making learning easy and enjoyable. Visit and speak with the team — you'll immediately sense their dedication and passion for teaching.", author: "Kishore Gandhi", role: "Guitar student", initials: "KG", color: "#4285F4" },
    { quote: "I was looking for drum classes for my son and, after a bit of searching, decided to visit Hyderabad School of Music because it was nearby. From the moment I walked in, I was thrilled by the lively activities and the welcoming atmosphere. The staff is not only talented but also incredibly friendly, creating a perfect environment for learning and creativity. My son is now learning drums here and making amazing progress, thanks to the patient and skilled instructors. My wife has also joined for advanced Hindustani music lessons, and she's just as impressed with the quality of teaching and the dedication of the faculty.", author: "Bharath Raj Kuttikad", role: "Parent", initials: "BK", color: "#34A853" },
    { quote: "My son is learning guitar in HSM from past 3 months. I am really happy with my decision. He is getting practical teaching lessons from good teachers who are very friendly. The HSM members have a lot of interest in music and take good care of the students. Recently, the members organized a musical event involving all age groups which was awesome. It was a good exposure for the students.", author: "Yodesh Shaw", role: "Parent of Guitar student", initials: "YS", color: "#EA4335" },
    { quote: "Nestled in the heart of our community, Hyderabad School Of Music (HSM) is a beacon of musical excellence. From the moment you step through the door, you're greeted with a warm atmosphere and a sense of belonging. I've had the pleasure of experiencing music education in various settings, and HSM stands out for its unwavering commitment to nurturing talent and fostering a love for music in students of all ages.", author: "Jayasudha Venkatesh", role: "Student", initials: "JV", color: "#9C27B0" },
    { quote: "Enrolled my kid for keyboard. He is enjoying the learning. Good facilities, sir pays attention to each student which is good. Would definitely recommend.", author: "B Srinivasu", role: "Parent of Keyboard student", initials: "BS", color: "#FBBC04" },
];

const LandingPage: React.FC<LandingPageProps> = ({ teachers, batches }) => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isPromoActive, setIsPromoActive] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [prefilledInstrument, setPrefilledInstrument] = useState('');
    const [isDemoDayFlow, setIsDemoDayFlow] = useState(false);
    const [testimonialIndex, setTestimonialIndex] = useState(0);
    const [activeFaq, setActiveFaq] = useState<number | null>(null);
    const [flashConfig, setFlashConfig] = useState<any>(null);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/flash-banner`);
                if (response.ok) {
                    const data = await response.json();
                    setFlashConfig(data);
                }
            } catch (err) {
                console.error('Failed to fetch flash banner config:', err);
            }
        };
        fetchConfig();
    }, []);

    useEffect(() => {
        const handleScroll = () => { setIsScrolled(window.scrollY > 50); };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setTestimonialIndex(prev => (prev + 1) % testimonials.length);
        }, 4000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.data?.type === 'hsm-intake-success') {
                localStorage.setItem('hsm_demo_booked', 'true');
                handleCloseModal();
            } else if (event.data?.type === 'hsm-intake-close') {
                handleCloseModal();
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleOpenModal = (e: React.MouseEvent, instrument?: string, isDemoDay?: boolean) => {
        e.preventDefault();
        setPrefilledInstrument(instrument || '');
        setIsDemoDayFlow(!!isDemoDay);
        setIsModalOpen(true);
        document.body.style.overflow = 'hidden';
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        document.body.style.overflow = '';
    };

    const intakeSrc = `${PORTAL_URL}/intake?embed=1` +
        (prefilledInstrument ? `&instrument=${encodeURIComponent(prefilledInstrument)}` : '') +
        (isDemoDayFlow ? `&demo_type=demo_day` : '');

    return (
        <div className={`landing-wrapper ${isPromoActive ? 'has-promo' : ''}`}>
            <PromoBanner onVisibilityChange={setIsPromoActive} />
            <Navbar
                isScrolled={isScrolled}
                onLogin={() => { window.location.href = `${API_BASE_URL}/api/auth/google`; }}
                onOpenModal={handleOpenModal}
                promoActive={isPromoActive}
            />

            <main className="stacking-container">
                <HeroSection onOpenModal={handleOpenModal} flashConfig={flashConfig} />
                <InstrumentShowcase onOpenModal={handleOpenModal} />
                <WhyHSM />
                <MethodologyInfographic />
                <HSMMethodSection />
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

            <PublicCleffChat onBookDemo={() => handleOpenModal({ preventDefault: () => {} } as React.MouseEvent)} />

            <ExitIntentModal
                apiBaseUrl={API_BASE_URL}
                onOpenBooking={() => handleOpenModal({ preventDefault: () => {} } as React.MouseEvent)}
            />

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
                            src={intakeSrc}
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
