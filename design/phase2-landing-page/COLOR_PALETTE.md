# HSM Landing Page — Color Palette Reference 🎨

**Spotify-Inspired Color System**

---

## Primary Colors

### Dark Theme Foundation
```css
/* Deep Backgrounds */
--color-black: #0A0A0A;
--color-navy: #1A1F3A;
--color-dark-gray: #121212;

/* Card Backgrounds */
--color-card-dark: rgba(26, 31, 58, 0.8);
--color-card-hover: rgba(26, 31, 58, 0.95);
```

### Brand Accent Colors
```css
/* Primary Accent - Creativity & Music */
--color-purple-500: #8B5CF6;
--color-purple-600: #7C3AED;
--color-purple-700: #6D28D9;

/* Secondary Accent - Trust & Technology */
--color-blue-500: #3B82F6;
--color-blue-600: #2563EB;
--color-blue-700: #1D4ED8;

/* Action/CTA - Energy & Excitement */
--color-orange-500: #F97316;
--color-orange-600: #EA580C;
--color-orange-700: #C2410C;
```

---

## Text Colors

### Light Text on Dark Backgrounds
```css
--text-primary: #FFFFFF;          /* 100% opacity - Headlines */
--text-secondary: rgba(255, 255, 255, 0.87);  /* Body text */
--text-tertiary: rgba(255, 255, 255, 0.60);   /* Captions */
--text-disabled: rgba(255, 255, 255, 0.38);   /* Disabled states */
```

### Semantic Colors
```css
--color-success: #10B981;   /* Success states, confirmations */
--color-warning: #F59E0B;   /* Warnings, alerts */
--color-error: #EF4444;     /* Errors, validation */
--color-info: #3B82F6;      /* Information, tips */
```

---

## Gradient Definitions

### Hero Gradients
```css
/* Main Hero Background */
.hero-gradient {
  background: linear-gradient(
    135deg,
    #8B5CF6 0%,
    #3B82F6 100%
  );
}

/* Hero Overlay for Video/Image */
.hero-overlay {
  background: linear-gradient(
    180deg,
    rgba(10, 10, 10, 0) 0%,
    rgba(10, 10, 10, 0.6) 50%,
    rgba(10, 10, 10, 0.9) 100%
  );
}
```

### Button Gradients
```css
/* Primary CTA Button */
.cta-gradient {
  background: linear-gradient(
    90deg,
    #F97316 0%,
    #EA580C 100%
  );
}

/* Secondary Button Hover */
.secondary-hover {
  background: linear-gradient(
    135deg,
    rgba(139, 92, 246, 0.2) 0%,
    rgba(59, 130, 246, 0.2) 100%
  );
}
```

### Card Gradients
```css
/* Instrument Card Hover */
.card-hover-gradient {
  background: linear-gradient(
    180deg,
    rgba(26, 31, 58, 0) 0%,
    rgba(139, 92, 246, 0.3) 100%
  );
}

/* Pricing Card Popular */
.popular-card-gradient {
  background: linear-gradient(
    135deg,
    rgba(139, 92, 246, 0.1) 0%,
    rgba(59, 130, 246, 0.1) 100%
  );
  border: 2px solid #8B5CF6;
}
```

---

## Glassmorphism Effects

```css
.glass-card {
  background: rgba(26, 31, 58, 0.6);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.glass-nav {
  background: rgba(10, 10, 10, 0.8);
  backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
```

---

## Shadow System

### Elevation Levels
```css
/* Card Shadows */
--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.1);
--shadow-md: 0 4px 16px rgba(0, 0, 0, 0.2);
--shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.3);
--shadow-xl: 0 16px 64px rgba(0, 0, 0, 0.4);

/* Glow Effects */
--glow-purple: 0 0 30px rgba(139, 92, 246, 0.5);
--glow-blue: 0 0 30px rgba(59, 130, 246, 0.5);
--glow-orange: 0 0 30px rgba(249, 115, 22, 0.5);

/* Combined Shadow + Glow */
--shadow-glow-purple: 
  0 8px 32px rgba(0, 0, 0, 0.3),
  0 0 30px rgba(139, 92, 246, 0.4);
```

---

## Usage Guidelines

### Do's ✅
- Use dark backgrounds (#0A0A0A, #1A1F3A) for immersive feel
- Apply purple (#8B5CF6) for music/creativity emphasis
- Use orange (#F97316) sparingly for CTAs only
- Maintain high contrast (15:1 minimum) for text
- Apply glassmorphism for modern, layered effects

### Don'ts ❌
- Don't use light backgrounds (breaks dark theme consistency)
- Don't mix too many accent colors on one section
- Don't use low-contrast color combinations
- Don't overuse gradients (1-2 per section maximum)
- Don't apply glow effects to all elements

---

## Color Contrast Ratios

### WCAG AA Compliance
```
White (#FFFFFF) on Black (#0A0A0A):     21:1 ✅
White (#FFFFFF) on Navy (#1A1F3A):      16.5:1 ✅
Purple (#8B5CF6) on Black (#0A0A0A):    8.2:1 ✅
Orange (#F97316) on Black (#0A0A0A):    7.4:1 ✅
Blue (#3B82F6) on Black (#0A0A0A):      6.9:1 ✅
```

---

## Dark Theme Inspiration

### Spotify's Color Philosophy
- **Deep Blacks:** Create depth and premium feel
- **Vibrant Accents:** Stand out against dark backgrounds
- **Subtle Grays:** For hierarchy without harshness
- **Generous Spacing:** Let colors breathe

### HSM Adaptation
- **Musical Purple:** Represents creativity and artistry
- **Tech Blue:** Represents modern, digital platform
- **Energetic Orange:** Represents passion and action
- **Navy Accents:** Adds sophistication to pure black

---

## Implementation Example

```css
:root {
  /* Backgrounds */
  --bg-primary: #0A0A0A;
  --bg-secondary: #1A1F3A;
  --bg-card: rgba(26, 31, 58, 0.8);
  
  /* Accents */
  --accent-purple: #8B5CF6;
  --accent-blue: #3B82F6;
  --accent-orange: #F97316;
  
  /* Text */
  --text-primary: #FFFFFF;
  --text-secondary: rgba(255, 255, 255, 0.87);
  --text-tertiary: rgba(255, 255, 255, 0.60);
  
  /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.1);
  --border-strong: rgba(255, 255, 255, 0.2);
}

body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

.card {
  background: var(--bg-card);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border-subtle);
}

.cta-button {
  background: linear-gradient(90deg, var(--accent-orange) 0%, #EA580C 100%);
  color: var(--text-primary);
  box-shadow: 0 0 30px rgba(249, 115, 22, 0.5);
}
```

---

**Last Updated:** January 19, 2026
