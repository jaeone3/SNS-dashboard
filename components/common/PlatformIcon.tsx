import { Globe, type LucideIcon } from "lucide-react";

// ---------- Brand SVG logos ----------

const TikTokLogo = ({ size = 20, className }: { size?: number; className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    width={size}
    height={size}
    className={className}
    fill="none"
  >
    {/* Black circle background */}
    <circle cx="24" cy="24" r="22" fill="#000" />
    {/* Music note ♪ — simplified TikTok note icon */}
    <path
      d="M29.5 12.5v15a5.5 5.5 0 1 1-3-4.9V12.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1z"
      fill="#25F4EE"
    />
    <path
      d="M30.5 13.5v15a5.5 5.5 0 1 1-3-4.9V13.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1z"
      fill="#FE2C55"
    />
    <path
      d="M30 13v15a5.5 5.5 0 1 1-3-4.9V13a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1z"
      fill="#fff"
    />
  </svg>
);

const InstagramLogo = ({ size = 20, className }: { size?: number; className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    width={size}
    height={size}
    className={className}
  >
    <defs>
      <radialGradient id="ig_grad1" cx="19.38" cy="42.04" r="44.9" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#fd5" />
        <stop offset=".1" stopColor="#fd5" />
        <stop offset=".5" stopColor="#ff543e" />
        <stop offset="1" stopColor="#c837ab" />
      </radialGradient>
      <radialGradient id="ig_grad2" cx="11.79" cy="-0.66" r="65.84" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#3771c8" />
        <stop offset=".13" stopColor="#3771c8" />
        <stop offset="1" stopColor="#60f" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#ig_grad1)" />
    <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#ig_grad2)" />
    <circle cx="24" cy="24" r="9" fill="none" stroke="#fff" strokeWidth="3" />
    <circle cx="35.5" cy="12.5" r="2" fill="#fff" />
    <rect x="8" y="8" width="32" height="32" rx="10" fill="none" stroke="#fff" strokeWidth="3" />
  </svg>
);

const YouTubeLogo = ({ size = 20, className }: { size?: number; className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    width={size}
    height={size}
    className={className}
  >
    <path
      fill="#FF0000"
      d="M43.2 13.4a6 6 0 0 0-4.2-4.3C35.7 8 24 8 24 8s-11.7 0-15 1.1a6 6 0 0 0-4.2 4.3C3.6 16.7 3.6 24 3.6 24s0 7.3 1.2 10.6a6 6 0 0 0 4.2 4.3C12.3 40 24 40 24 40s11.7 0 15-1.1a6 6 0 0 0 4.2-4.3c1.2-3.3 1.2-10.6 1.2-10.6s0-7.3-1.2-10.6z"
    />
    <path fill="#FFF" d="M19.7 30.7V17.3L31.4 24z" />
  </svg>
);

const FacebookLogo = ({ size = 20, className }: { size?: number; className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    width={size}
    height={size}
    className={className}
  >
    <circle cx="24" cy="24" r="22" fill="#1877F2" />
    <path
      fill="#fff"
      d="M32.3 30.5l1.1-6.8h-6.5v-4.4c0-1.9.9-3.7 3.8-3.7h3v-5.8s-2.7-.5-5.3-.5c-5.4 0-9 3.3-9 9.2v5.2h-6v6.8h6V46a23.9 23.9 0 0 0 7.4 0V30.5h5.5z"
    />
  </svg>
);

// ---------- Logo component map ----------

type LogoComponent = React.FC<{ size?: number; className?: string }>;

const BRAND_LOGO_MAP: Record<string, LogoComponent> = {
  tiktok: TikTokLogo,
  instagram: InstagramLogo,
  youtube: YouTubeLogo,
  facebook: FacebookLogo,
};

// Fallback to lucide icons for unknown platforms
const LUCIDE_MAP: Record<string, LucideIcon> = {
  globe: Globe,
};

// ---------- Public component ----------

interface PlatformIconProps {
  /** Platform name (lowercase) e.g. "tiktok", OR lucide icon name e.g. "globe" */
  iconName: string;
  className?: string;
  size?: number;
}

export const PlatformIcon = ({
  iconName,
  className,
  size = 20,
}: PlatformIconProps) => {
  // Try brand logo first
  const BrandLogo = BRAND_LOGO_MAP[iconName];
  if (BrandLogo) {
    return <BrandLogo size={size} className={className} />;
  }

  // Fallback: lucide icon
  const Icon = LUCIDE_MAP[iconName] ?? Globe;
  return <Icon className={className} size={size} />;
};
