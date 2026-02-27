// Script for Prototype 3 - Stacking Scroll Effects, Modal, and Theme Toggle

document.addEventListener('DOMContentLoaded', () => {

    // 1. Navbar visual change on scroll
    const navbar = document.getElementById('navbar');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // 2. Theme Toggle Logic
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;

    // Check local storage for theme preference
    const currentTheme = localStorage.getItem('theme');

    // Function to swap instrument images based on theme
    function updateImageSources(isDark) {
        const images = document.querySelectorAll('img[src*="assets/"]');
        images.forEach(img => {
            let src = img.getAttribute('src');
            if (isDark) {
                if (!src.includes('_dark.png')) {
                    img.src = src.replace('.png', '_dark.png');
                }
            } else {
                if (src.includes('_dark.png')) {
                    img.src = src.replace('_dark.png', '.png');
                }
            }
        });
    }

    if (currentTheme === 'dark') {
        body.classList.add('dark-theme');
        themeToggle.textContent = '☀';
        updateImageSources(true);
    }

    themeToggle.addEventListener('click', () => {
        body.classList.toggle('dark-theme');

        let theme = 'light';
        let isDark = false;
        if (body.classList.contains('dark-theme')) {
            theme = 'dark';
            isDark = true;
            themeToggle.textContent = '☀';
        } else {
            themeToggle.textContent = '☾';
        }

        updateImageSources(isDark);

        // Save preference
        localStorage.setItem('theme', theme);
    });

    // 3. Modal Logic
    const trialModal = document.getElementById('trialModal');
    const closeModalBtn = document.getElementById('closeModal');

    // Find all links/buttons that should open the modal (anything pointing to #trial)
    const trialTriggers = document.querySelectorAll('a[href="#trial"], .btn-cta');

    trialTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            // Only prevent default if it's an anchor link trying to scroll
            if (trigger.tagName === 'A') {
                e.preventDefault();
            }
            trialModal.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        });
    });

    // Close on button click
    closeModalBtn.addEventListener('click', () => {
        trialModal.classList.remove('active');
        document.body.style.overflow = '';
    });

    // Close on outside click
    trialModal.addEventListener('click', (e) => {
        if (e.target === trialModal) {
            trialModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    // Handle form submission (Mock)
    const trialForm = document.getElementById('trialForm');
    if (trialForm) {
        trialForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const submitBtn = trialForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;

            submitBtn.textContent = 'Booking Confirmed! 🎉';
            submitBtn.style.backgroundColor = '#10b981'; // Green success

            setTimeout(() => {
                trialModal.classList.remove('active');
                document.body.style.overflow = '';
                trialForm.reset();

                // Reset button
                setTimeout(() => {
                    submitBtn.textContent = originalText;
                    submitBtn.style.backgroundColor = '';
                }, 500);
            }, 2000);
        });
    }

});
