interface CleffAvatarProps {
  size?: number;
}

export function CleffAvatar({ size = 36 }: CleffAvatarProps) {
  return (
    <img
      src="/images/cleff_talking.gif"
      alt="Cleff"
      width={size}
      height={size}
      style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }}
    />
  );
}
