# Data Migration: Payment Cycle Mapping

**Objective:** To map the free-text "Payment Cycle" values from `HSM_Students_Data.csv` to the structured `payment_frequency` enum (`monthly`, `quarterly`, `half_yearly`, `yearly`) in the new database.

## Mapping Logic

The migration script will use the following rules to determine the `payment_frequency` for each student's enrollment. The rules are processed in order.

| Condition (Case-Insensitive) | Mapped Value | Credits Added |
| :--- | :--- | :--- |
| If legacy value contains `Family` | `quarterly` | 24 |
| If legacy value contains `Quarterly` | `quarterly` | 24 |
| If legacy value contains `Half` | `half_yearly` | 48 |
| If legacy value contains `Annual` or `Yearly` | `yearly` | 96 |
| If legacy value contains `Monthly` | `monthly` | 8 |
| **Default (for any other value)** | `monthly` | 8 |

## Implementation in Migration Script

A function within the migration script will implement this logic.

```javascript
function mapPaymentFrequency(legacyValue) {
  const lowerValue = (legacyValue || '').toLowerCase();

  if (lowerValue.includes('family') || lowerValue.includes('quarterly')) {
    return 'quarterly';
  }
  if (lowerValue.includes('half')) {
    return 'half_yearly';
  }
  if (lowerValue.includes('annual') || lowerValue.includes('yearly')) {
    return 'yearly';
  }
  // Default to monthly for "Monthly" or any other unspecified value
  return 'monthly';
}
```

During the student import process, the script will use this function to set the `payment_frequency` on the `enrollment_batches` record and to calculate the initial `total_credits` to be stored in the student's metadata.