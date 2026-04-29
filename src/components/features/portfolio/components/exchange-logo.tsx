'use client';

import Image from 'next/image';

interface ExchangeLogoProps {
  name: string;
  mark: string | null;
}

const exchangeLogoMap: Record<
  string,
  { src: string; alt: string; width: number; height: number; className?: string }
> = {
  Hyperliquid: {
    src: '/tokens/hype.png',
    alt: 'Hyperliquid logo',
    width: 18,
    height: 18,
    className: 'rounded-full',
  },
  Pacifica: {
    src: '/tokens/pacifica.jpg',
    alt: 'Pacifica logo',
    width: 18,
    height: 18,
    className: 'rounded-full',
  },
  Backpack: {
    src: '/tokens/backpack.svg',
    alt: 'Backpack logo',
    width: 14,
    height: 14,
  },
  Lighter: {
    src: '/tokens/lighter.jpg',
    alt: 'Lighter logo',
    width: 18,
    height: 18,
    className: 'rounded-full',
  },
};

export function ExchangeLogo({ name, mark }: ExchangeLogoProps) {
  const logo = exchangeLogoMap[name];

  if (!mark) {
    return <span className="text-lg font-medium tracking-tight text-text-primary">{name}</span>;
  }

  return (
    <div className="flex items-center gap-2">
      {logo ? (
        <Image
          src={logo.src}
          alt={logo.alt}
          width={logo.width}
          height={logo.height}
          className={logo.className}
        />
      ) : (
        <div className="flex h-4.5 w-4.5 items-center justify-center rounded-full border border-border-white-10 text-[10px] text-text-primary">
          {mark}
        </div>
      )}
      <span className="text-[15px] font-medium tracking-tight text-text-primary">{name}</span>
    </div>
  );
}
