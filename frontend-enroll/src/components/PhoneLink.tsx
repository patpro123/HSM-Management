import React from 'react';

interface PhoneLinkProps {
  phone?: string | null;
  fallback?: string;
  className?: string;
}

const PhoneLink: React.FC<PhoneLinkProps> = ({ phone, fallback = '—', className = '' }) => {
  if (!phone || phone === 'N/A' || phone === '—') {
    return <span className={className}>{fallback}</span>;
  }
  return (
    <a
      href={`tel:${phone}`}
      className={`hover:text-indigo-600 hover:underline transition-colors ${className}`}
    >
      {phone}
    </a>
  );
};

export default PhoneLink;
