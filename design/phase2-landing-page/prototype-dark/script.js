// HSM Prototype Scripts

document.addEventListener('DOMContentLoaded', () => {

    // 1. Navigation Scroll Effect
    const navbar = document.getElementById('navbar');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // 2. Scroll Reveal Animations using Intersection Observer
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Add minor stagger based on data attribute if present
                const delay = entry.target.getAttribute('data-delay') || 0;

                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, delay);

                // Optional: Stop observing once revealed
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const revealElements = document.querySelectorAll('.fade-up-scroll');
    revealElements.forEach(el => observer.observe(el));


    // 3. Inject Mock Testimonials for Infinite Scroll
    const testimonialTrack = document.getElementById('testimonialTrack');

    const testimonials = [
        {
            text: "My daughter has been learning piano here for two years. The progress she has made is extraordinary. The teachers truly care.",
            name: "Priya Menon",
            role: "Parent"
        },
        {
            text: "The music production course gave me the exact technical foundations I needed to start mixing my own tracks. Highly recommended.",
            name: "Arjun Reddy",
            role: "Student (Production)"
        },
        {
            text: "Preparing for my Trinity exams was rigorous but incredibly rewarding thanks to the structured curriculum and dedicated faculty.",
            name: "Sarah V.",
            role: "Grade 5 Violin"
        },
        {
            text: "A beautiful, creative environment. Even as an adult beginner, I felt completely welcomed and supported in my guitar journey.",
            name: "Rohit Desai",
            role: "Adult Learner"
        }
    ];

    // Create cards
    function createCard(data) {
        const div = document.createElement('div');
        div.className = 'testimonial-card';
        div.innerHTML = `
            <div class="quote-icon">"</div>
            <p class="testimonial-text">${data.text}</p>
            <div class="testimonial-author">
                <div class="author-img"></div>
                <div class="author-info">
                    <h5>${data.name}</h5>
                    <p>${data.role}</p>
                </div>
            </div>
        `;
        return div;
    }

    // Append twice to create infinite scroll illusion
    if (testimonialTrack) {
        testimonials.forEach(t => testimonialTrack.appendChild(createCard(t)));
        testimonials.forEach(t => testimonialTrack.appendChild(createCard(t)));
    }

});
