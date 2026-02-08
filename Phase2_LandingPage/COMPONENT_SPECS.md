# HSM Landing Page — Component Specifications 🧩

**Detailed Component Library**

---

## Navigation Component

### Desktop Navigation
```typescript
interface NavigationProps {
  isScrolled: boolean;
  currentSection: string;
}

<Navigation>
  <Logo />
  <NavLinks>
    <NavLink href="#courses" active={current === 'courses'}>Courses</NavLink>
    <NavLink href="#about">About</NavLink>
    <NavLink href="#teachers">Teachers</NavLink>
    <NavLink href="#testimonials">Testimonials</NavLink>
    <NavLink href="#pricing">Pricing</NavLink>
    <NavLink href="#contact">Contact</NavLink>
  </NavLinks>
  <NavActions>
    <Button variant="ghost">Sign In</Button>
    <Button variant="primary">Enroll Now</Button>
  </NavActions>
</Navigation>
```

### Specifications
- **Height:** 80px fixed
- **Position:** sticky, top: 0, z-index: 1000
- **Background:** 
  - Transparent when scrollY < 100px
  - rgba(10, 10, 10, 0.8) with backdrop-blur when scrolled
- **Transition:** background 0.3s ease
- **Logo:** 48px height, auto width
- **Link Spacing:** 32px between items
- **Link Hover:** Underline 2px purple, fade-in 0.2s

---

## Hero Section Component

### Structure
```typescript
<HeroSection>
  <HeroBackground>
    <Video autoPlay loop muted playsInline />
    <Overlay /> {/* Gradient overlay */}
  </HeroBackground>
  
  <HeroContent>
    <Badge>🎵 500+ Students | 15+ Expert Teachers</Badge>
    <Heading1>Where Music Dreams Take Flight</Heading1>
    <Subtitle>
      Learn Keyboard, Guitar, Drums, Vocals & More from Expert Musicians
    </Subtitle>
    <CTAGroup>
      <Button variant="primary" size="large">
        Start Your Musical Journey →
      </Button>
      <Button variant="secondary" size="large">
        ▶ Watch Introduction
      </Button>
    </CTAGroup>
  </HeroContent>
  
  <ScrollIndicator />
</HeroSection>
```

### Specifications

#### Heading1
```css
font-size: 72px;
font-weight: 700;
line-height: 1.1;
letter-spacing: -0.02em;
background: linear-gradient(135deg, #FFFFFF 0%, #E0E0E0 100%);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
animation: fadeInUp 1s ease-out;

@media (max-width: 768px) {
  font-size: 40px;
}
```

#### CTAGroup
```css
display: flex;
gap: 16px;
margin-top: 48px;

@media (max-width: 768px) {
  flex-direction: column;
  width: 100%;
}
```

#### ScrollIndicator
```css
position: absolute;
bottom: 32px;
left: 50%;
transform: translateX(-50%);
animation: bounce 2s infinite;

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% { transform: translateX(-50%) translateY(0); }
  40% { transform: translateX(-50%) translateY(-10px); }
  60% { transform: translateX(-50%) translateY(-5px); }
}
```

---

## Button Component

### Variants
```typescript
type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps {
  variant: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}
```

### Styles

#### Primary Button (CTA)
```css
background: linear-gradient(90deg, #F97316 0%, #EA580C 100%);
color: #FFFFFF;
padding: 16px 32px; /* medium */
border-radius: 8px;
font-size: 16px;
font-weight: 600;
border: none;
cursor: pointer;
transition: all 0.3s ease;

&:hover {
  transform: scale(1.05);
  box-shadow: 0 0 30px rgba(249, 115, 22, 0.6);
  filter: brightness(1.1);
}

&:active {
  transform: scale(0.98);
}

&.large {
  padding: 20px 40px;
  font-size: 18px;
}

&.small {
  padding: 12px 24px;
  font-size: 14px;
}
```

#### Secondary Button
```css
background: transparent;
color: #FFFFFF;
border: 2px solid rgba(255, 255, 255, 0.3);
padding: 16px 32px;
border-radius: 8px;
backdrop-filter: blur(10px);

&:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: #8B5CF6;
  box-shadow: 0 0 20px rgba(139, 92, 246, 0.4);
}
```

#### Ghost Button
```css
background: transparent;
color: rgba(255, 255, 255, 0.87);
border: none;
padding: 12px 24px;

&:hover {
  color: #FFFFFF;
  background: rgba(255, 255, 255, 0.05);
}
```

---

## Instrument Card Component

### Structure
```typescript
interface InstrumentCardProps {
  id: string;
  name: string;
  image: string;
  description: string;
  onlineAvailable: boolean;
  onClick: (id: string) => void;
}

<InstrumentCard>
  <CardImage src={image} alt={name} />
  {onlineAvailable && <Badge>Online Available</Badge>}
  <CardContent>
    <CardTitle>{name}</CardTitle>
    <CardDescription>{description}</CardDescription>
  </CardContent>
  <CardOverlay>
    <Button>Learn More →</Button>
  </CardOverlay>
</InstrumentCard>
```

### Specifications
```css
.instrument-card {
  width: 280px;
  height: 340px;
  border-radius: 12px;
  background: #1A1F3A;
  overflow: hidden;
  position: relative;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.card-image {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.card-content {
  padding: 20px;
}

.card-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 8px;
}

.card-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(26, 31, 58, 0) 0%,
    rgba(139, 92, 246, 0.9) 100%
  );
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 32px;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.instrument-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 0 20px 60px rgba(139, 92, 246, 0.4);
}

.instrument-card:hover .card-overlay {
  opacity: 1;
}

/* Badge */
.badge {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(59, 130, 246, 0.9);
  color: white;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 600;
  backdrop-filter: blur(10px);
}
```

---

## Testimonial Card Component

### Structure
```typescript
interface TestimonialProps {
  id: string;
  studentName: string;
  instrument: string;
  quote: string;
  image: string;
  rating: number;
}

<TestimonialCard>
  <QuoteIcon />
  <Quote>{quote}</Quote>
  <StudentInfo>
    <Avatar src={image} alt={studentName} />
    <Details>
      <Name>{studentName}</Name>
      <Instrument>{instrument}</Instrument>
      <Rating stars={rating} />
    </Details>
  </StudentInfo>
</TestimonialCard>
```

### Specifications
```css
.testimonial-card {
  background: rgba(26, 31, 58, 0.6);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 32px;
  min-width: 350px;
  max-width: 450px;
}

.quote-icon {
  width: 40px;
  height: 40px;
  color: #8B5CF6;
  margin-bottom: 16px;
}

.quote {
  font-size: 18px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.87);
  margin-bottom: 24px;
  font-style: italic;
}

.student-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 2px solid #8B5CF6;
}

.name {
  font-size: 16px;
  font-weight: 600;
  color: #FFFFFF;
}

.instrument {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.60);
}

.rating {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.star {
  width: 16px;
  height: 16px;
  color: #F59E0B;
}
```

---

## Pricing Card Component

### Structure
```typescript
interface PricingCardProps {
  title: string;
  price: number;
  frequency: 'monthly' | 'quarterly';
  features: string[];
  isPopular?: boolean;
  discount?: number;
}

<PricingCard isPopular={isPopular}>
  {isPopular && <PopularBadge>⭐ Most Popular</PopularBadge>}
  <PlanTitle>{title}</PlanTitle>
  <Price>
    <Currency>₹</Currency>
    <Amount>{price}</Amount>
    <Period>/{frequency}</Period>
  </Price>
  {discount && <Discount>Save {discount}%</Discount>}
  <FeatureList>
    {features.map(feature => (
      <Feature key={feature}>
        <CheckIcon />
        <span>{feature}</span>
      </Feature>
    ))}
  </FeatureList>
  <Button variant="primary" fullWidth>Get Started</Button>
</PricingCard>
```

### Specifications
```css
.pricing-card {
  background: rgba(26, 31, 58, 0.8);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 40px;
  width: 360px;
  position: relative;
  transition: all 0.4s ease;
}

.pricing-card.popular {
  transform: scale(1.08);
  border-color: #8B5CF6;
  background: linear-gradient(
    135deg,
    rgba(139, 92, 246, 0.2) 0%,
    rgba(59, 130, 246, 0.2) 100%
  );
  z-index: 1;
}

.popular-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(90deg, #8B5CF6 0%, #3B82F6 100%);
  color: white;
  padding: 6px 20px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.plan-title {
  font-size: 24px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 24px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.price {
  display: flex;
  align-items: baseline;
  justify-content: center;
  margin-bottom: 8px;
}

.currency {
  font-size: 24px;
  color: rgba(255, 255, 255, 0.60);
}

.amount {
  font-size: 56px;
  font-weight: 700;
  color: #FFFFFF;
  margin: 0 8px;
}

.period {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.60);
}

.discount {
  text-align: center;
  color: #10B981;
  font-weight: 600;
  margin-bottom: 32px;
}

.feature-list {
  margin-bottom: 32px;
}

.feature {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  color: rgba(255, 255, 255, 0.87);
}

.check-icon {
  width: 20px;
  height: 20px;
  color: #10B981;
  flex-shrink: 0;
}

.pricing-card:hover {
  transform: translateY(-8px) rotate(1deg);
  box-shadow: 0 20px 60px rgba(139, 92, 246, 0.5);
}

.pricing-card.popular:hover {
  transform: scale(1.08) translateY(-8px);
}
```

---

## FAQ Accordion Component

### Structure
```typescript
interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

<FAQAccordion items={faqs}>
  {faqs.map(item => (
    <AccordionItem key={item.id}>
      <AccordionButton>
        <Question>{item.question}</Question>
        <ChevronIcon expanded={isExpanded} />
      </AccordionButton>
      <AccordionPanel expanded={isExpanded}>
        <Answer>{item.answer}</Answer>
      </AccordionPanel>
    </AccordionItem>
  ))}
</FAQAccordion>
```

### Specifications
```css
.accordion-item {
  background: rgba(26, 31, 58, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  margin-bottom: 16px;
  overflow: hidden;
}

.accordion-button {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #FFFFFF;
  font-size: 18px;
  font-weight: 600;
  text-align: left;
  transition: background 0.2s ease;
}

.accordion-button:hover {
  background: rgba(139, 92, 246, 0.1);
}

.chevron-icon {
  width: 24px;
  height: 24px;
  transition: transform 0.3s ease;
}

.chevron-icon.expanded {
  transform: rotate(90deg);
}

.accordion-panel {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease-in-out;
}

.accordion-panel.expanded {
  max-height: 500px;
}

.answer {
  padding: 0 32px 24px;
  color: rgba(255, 255, 255, 0.87);
  font-size: 16px;
  line-height: 1.6;
}
```

---

## Footer Component

### Structure
```typescript
<Footer>
  <FooterTop>
    <FooterColumn>
      <Logo />
      <Tagline>Where Music Dreams Take Flight</Tagline>
    </FooterColumn>
    
    <FooterColumn title="Courses">
      <FooterLink href="/keyboard">Keyboard</FooterLink>
      <FooterLink href="/guitar">Guitar</FooterLink>
      <FooterLink href="/drums">Drums</FooterLink>
      <FooterLink href="/vocals">Vocals</FooterLink>
      {/* ... more courses */}
    </FooterColumn>
    
    <FooterColumn title="Resources">
      <FooterLink href="/blog">Blog</FooterLink>
      <FooterLink href="/faqs">FAQs</FooterLink>
      <FooterLink href="/schedule">Schedule</FooterLink>
    </FooterColumn>
    
    <FooterColumn title="Connect">
      <ContactInfo icon="📍">Address Line</ContactInfo>
      <ContactInfo icon="📞">+91 XXXXXXXXXX</ContactInfo>
      <ContactInfo icon="📧">info@hsm.in</ContactInfo>
      <SocialLinks>
        <SocialIcon platform="instagram" />
        <SocialIcon platform="facebook" />
        <SocialIcon platform="youtube" />
      </SocialLinks>
    </FooterColumn>
  </FooterTop>
  
  <FooterBottom>
    <Copyright>© 2026 Hyderabad School of Music</Copyright>
    <LegalLinks>
      <FooterLink href="/privacy">Privacy Policy</FooterLink>
      <FooterLink href="/terms">Terms of Service</FooterLink>
      <FooterLink href="/refunds">Refund Policy</FooterLink>
    </LegalLinks>
  </FooterBottom>
</Footer>
```

### Specifications
```css
.footer {
  background: #0A0A0A;
  padding: 80px 0 32px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.footer-top {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1.5fr;
  gap: 64px;
  margin-bottom: 64px;
}

@media (max-width: 768px) {
  .footer-top {
    grid-template-columns: 1fr;
    gap: 40px;
  }
}

.footer-column h4 {
  font-size: 16px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 16px;
  color: #8B5CF6;
}

.footer-link {
  display: block;
  color: rgba(255, 255, 255, 0.60);
  text-decoration: none;
  padding: 8px 0;
  transition: color 0.2s ease;
}

.footer-link:hover {
  color: #FFFFFF;
  text-decoration: underline;
  text-decoration-color: #8B5CF6;
  text-underline-offset: 4px;
}

.social-links {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.social-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.social-icon:hover {
  background: #8B5CF6;
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(139, 92, 246, 0.4);
}

.footer-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 32px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.38);
  font-size: 14px;
}

@media (max-width: 768px) {
  .footer-bottom {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }
}
```

---

## Loading States

### Skeleton Card
```css
.skeleton-card {
  background: rgba(26, 31, 58, 0.6);
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}

.skeleton-card::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent
  );
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  100% {
    left: 100%;
  }
}
```

---

**Component Library Version:** 1.0  
**Last Updated:** January 19, 2026
