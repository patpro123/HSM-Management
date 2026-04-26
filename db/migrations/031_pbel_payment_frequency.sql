-- Migration 031: Add PBEL package types to payment_frequency enum
-- pbel_4 = 4-class package (PBEL City branch only)
-- pbel_8 = 8-class package (PBEL City branch only)

ALTER TYPE payment_frequency ADD VALUE IF NOT EXISTS 'pbel_4';
ALTER TYPE payment_frequency ADD VALUE IF NOT EXISTS 'pbel_8';

COMMENT ON TYPE payment_frequency IS
  'monthly=8cls, quarterly=24cls, pbel_4=4cls(PBEL), pbel_8=8cls(PBEL), half_yearly=48cls, yearly=96cls';
