export interface Plan {
  name: string;
  classes: number;
  priceLabel: string;
  description: string;
  highlight?: boolean;
}

export const PLANS: Plan[] = [
  {
    name: 'Free Demo Class',
    classes: 1,
    priceLabel: '₹0',
    description: 'No commitment — see if it clicks before you pay anything.',
  },
  {
    name: 'Trial Pack',
    classes: 4,
    priceLabel: 'From ₹2,000',
    description: 'Four classes to properly get started once the demo goes well.',
  },
  {
    name: 'Quarterly Pack',
    classes: 24,
    priceLabel: 'Contact us for pricing',
    description: 'One quarter (12 weeks) of twice-weekly classes — HSM\'s standard ongoing plan.',
    highlight: true,
  },
];

/** Keeps the FAQ answer text and the pricing block from drifting apart. */
export function plansFaqAnswer(): string {
  const trial = PLANS.find(p => p.name === 'Trial Pack');
  const quarterly = PLANS.find(p => p.name === 'Quarterly Pack');
  return `We offer a Trial Pack (${trial?.classes} classes, starting ${trial?.priceLabel.replace('From ', '')}) and a Quarterly Pack (${quarterly?.classes} classes). Your first demo class is completely free — no commitment.`;
}
