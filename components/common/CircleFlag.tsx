import Image from "next/image";
import { Globe } from "lucide-react";

const FLAG_CDN = "https://hatscripts.github.io/circle-flags/flags";

interface CircleFlagProps {
  countryCode: string | undefined; // "KR", "US", "JP" etc.
  size?: number;
}

export const CircleFlag = ({ countryCode, size = 20 }: CircleFlagProps) => {
  if (!countryCode) {
    return <Globe size={size} className="shrink-0 text-neutral-400" />;
  }

  const code = countryCode.toLowerCase();

  return (
    <Image
      src={`${FLAG_CDN}/${code}.svg`}
      alt={`${countryCode} flag`}
      width={size}
      height={size}
      className="shrink-0 rounded-full"
      unoptimized
    />
  );
};
