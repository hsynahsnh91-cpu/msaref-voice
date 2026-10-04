import type { ReactNode, SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function S({ size = 22, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconInbox = (p: IconProps) => (
  <S {...p}>
    <path d="M3 12h4l1.5 2.5h7L17 12h4" />
    <path d="M4.6 5.6 3 12v5.5A1.5 1.5 0 0 0 4.5 19h15a1.5 1.5 0 0 0 1.5-1.5V12l-1.6-6.4A1.5 1.5 0 0 0 17.9 4.5H6.1a1.5 1.5 0 0 0-1.5 1.1Z" />
  </S>
);

export const IconMic = (p: IconProps) => (
  <S {...p}>
    <rect x="9" y="2.5" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
    <path d="M12 17.5V21" />
    <path d="M8.5 21h7" />
  </S>
);

export const IconMicOff = (p: IconProps) => (
  <S {...p}>
    <path d="M15 5.5A3 3 0 0 0 9 5.5v4" />
    <path d="M9 12.2A3 3 0 0 0 15 13" />
    <path d="M5.5 11a6.5 6.5 0 0 0 10 5.5" />
    <path d="M18.5 11v.6" />
    <path d="M12 17.5V21" />
    <path d="M8.5 21h7" />
    <path d="m3 3 18 18" />
  </S>
);

export const IconReceipt = (p: IconProps) => (
  <S {...p}>
    <path d="M5 3.5h14v17l-2.3-1.4-2.4 1.4-2.3-1.4L9.7 20.5 7.3 19.1 5 20.5z" />
    <path d="M8.8 8h6.4M8.8 12h6.4M8.8 15.6h3.6" />
  </S>
);

export const IconSliders = (p: IconProps) => (
  <S {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2.1" />
    <circle cx="9" cy="17" r="2.1" />
  </S>
);

export const IconEye = (p: IconProps) => (
  <S {...p}>
    <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </S>
);

export const IconEyeOff = (p: IconProps) => (
  <S {...p}>
    <path d="M9.9 5.9A9.9 9.9 0 0 1 12 5.8c6 0 9.5 6.2 9.5 6.2a17 17 0 0 1-3.3 4" />
    <path d="M6.3 7.9A16.8 16.8 0 0 0 2.5 12S6 18.2 12 18.2a9.6 9.6 0 0 0 4-.85" />
    <path d="m9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="m3 3 18 18" />
  </S>
);

export const IconChevronLeft = (p: IconProps) => (
  <S {...p}>
    <path d="m14.5 5-7 7 7 7" />
  </S>
);

export const IconChevronRight = (p: IconProps) => (
  <S {...p}>
    <path d="m9.5 5 7 7-7 7" />
  </S>
);

export const IconChevronDown = (p: IconProps) => (
  <S {...p}>
    <path d="m5 9 7 7 7-7" />
  </S>
);

export const IconCalendar = (p: IconProps) => (
  <S {...p}>
    <rect x="3.2" y="4.8" width="17.6" height="16" rx="2.4" />
    <path d="M3.2 9.6h17.6M8 3v3.4M16 3v3.4" />
  </S>
);

export const IconX = (p: IconProps) => (
  <S {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </S>
);

export const IconCheck = (p: IconProps) => (
  <S {...p}>
    <path d="m4.5 12.5 5 5 10-11" />
  </S>
);

export const IconTrash = (p: IconProps) => (
  <S {...p}>
    <path d="M4 6.5h16M9.5 6.5V4.2h5v2.3M6.3 6.5 7.2 20a1.4 1.4 0 0 0 1.4 1.3h6.8a1.4 1.4 0 0 0 1.4-1.3l.9-13.5" />
    <path d="M10.3 10.5v6.5M13.7 10.5v6.5" />
  </S>
);

export const IconPlay = (p: IconProps) => (
  <S {...p}>
    <path d="M7.5 4.8 19 12 7.5 19.2z" fill="currentColor" stroke="none" />
  </S>
);

export const IconPause = (p: IconProps) => (
  <S {...p}>
    <rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none" />
    <rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none" />
  </S>
);

export const IconPlus = (p: IconProps) => (
  <S {...p}>
    <path d="M12 5v14M5 12h14" />
  </S>
);

export const IconSearch = (p: IconProps) => (
  <S {...p}>
    <circle cx="10.8" cy="10.8" r="6.3" />
    <path d="m15.6 15.6 4 4" />
  </S>
);

export const IconWallet = (p: IconProps) => (
  <S {...p}>
    <path d="M3.5 7.8A2.3 2.3 0 0 1 5.8 5.5h11.4a2.3 2.3 0 0 1 2.3 2.3v8.4a2.3 2.3 0 0 1-2.3 2.3H5.8a2.3 2.3 0 0 1-2.3-2.3z" />
    <path d="M3.5 9.6h16M16.4 14.2h1.6" />
  </S>
);

export const IconWave = (p: IconProps) => (
  <S {...p}>
    <path d="M3 12h1.6M7 8.2v7.6M11 5v14M15 8.8v6.4M19 11h1.8" />
  </S>
);

export const IconLock = (p: IconProps) => (
  <S {...p}>
    <rect x="4.5" y="10" width="15" height="10.5" rx="2.4" />
    <path d="M8 10V7.4a4 4 0 0 1 8 0V10" />
  </S>
);

export const IconMail = (p: IconProps) => (
  <S {...p}>
    <rect x="3" y="5.2" width="18" height="13.6" rx="2.4" />
    <path d="m3.8 7 7.1 5.2a2 2 0 0 0 2.2 0L20.2 7" />
  </S>
);

export const IconUser = (p: IconProps) => (
  <S {...p}>
    <circle cx="12" cy="8.2" r="3.7" />
    <path d="M4.8 20.2a7.4 7.4 0 0 1 14.4 0" />
  </S>
);

export const IconShield = (p: IconProps) => (
  <S {...p}>
    <path d="M12 3 5 5.8v5.5c0 4.3 2.9 8.1 7 9.2 4.1-1.1 7-4.9 7-9.2V5.8z" />
    <path d="m9.2 12 2 2 3.6-3.9" />
  </S>
);

export const IconVolume = (p: IconProps) => (
  <S {...p}>
    <path d="M4 9.5h3L11.5 6v12L7 14.5H4z" />
    <path d="M15 9.4a3.6 3.6 0 0 1 0 5.2M17.8 7a7 7 0 0 1 0 10" />
  </S>
);

export const IconVolumeOff = (p: IconProps) => (
  <S {...p}>
    <path d="M4 9.5h3L11.5 6v12L7 14.5H4z" />
    <path d="m15.5 10 4 4M19.5 10l-4 4" />
  </S>
);

export const IconExpense = (p: IconProps) => (
  <S {...p}>
    <path d="M6.5 6.5 17.5 17.5M17.5 17.5h-7M17.5 17.5v-7" />
  </S>
);

export const IconIncome = (p: IconProps) => (
  <S {...p}>
    <path d="M17.5 6.5 6.5 17.5M6.5 17.5h7M6.5 17.5v-7" />
  </S>
);

export const IconGlobe = (p: IconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.4 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.4-3.5-8.5S9.7 5.9 12 3.5Z" />
  </S>
);

export const IconPencil = (p: IconProps) => (
  <S {...p}>
    <path d="M4 20h4l10-10a2.4 2.4 0 0 0-3.4-3.4L4.6 16.6z" />
    <path d="m13.8 7.4 2.8 2.8" />
  </S>
);

export const IconInfo = (p: IconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.2M12 7.9h.01" />
  </S>
);

export const IconLoader = ({ size = 22, className = "", ...rest }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={`animate-spin ${className}`}
    aria-hidden="true"
    {...rest}
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2.4" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

export const IconArrowRight = (p: IconProps) => (
  <S {...p}>
    <path d="M4.5 12h15M13.5 6l6 6-6 6" />
  </S>
);

export const IconSparkle = (p: IconProps) => (
  <S {...p}>
    <path d="M12 3.5 13.8 9 19.5 11 13.8 13 12 18.5 10.2 13 4.5 11 10.2 9z" />
    <path d="M18.5 4.2 19.2 6l1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
  </S>
);

export function IconGoogle({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.86c2.26-2.08 3.58-5.15 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.86-3c-1.07.72-2.45 1.15-4.08 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.29a12 12 0 0 0 0 10.74l3.98-3.09Z" />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.43-3.43C17.95 1.19 15.23 0 12 0A12 12 0 0 0 1.29 6.63l3.98 3.09C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

export function IconApple({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.36 12.72c.03 3.15 2.77 4.2 2.8 4.21-.02.07-.44 1.5-1.45 2.99-.87 1.29-1.78 2.57-3.2 2.6-1.4.03-1.85-.83-3.45-.83-1.6 0-2.1.8-3.42.85-1.37.05-2.42-1.39-3.3-2.67C2.53 17.15 1.4 12.9 3.2 9.86a5.06 5.06 0 0 1 4.27-2.58c1.35-.02 2.62.9 3.45.9.82 0 2.37-1.11 3.99-.95.68.03 2.59.27 3.82 2.07-.1.06-2.28 1.32-2.37 3.42M13.9 4.98c.72-.87 1.2-2.08 1.07-3.28-1.03.04-2.28.69-3.02 1.56-.66.77-1.24 2-1.09 3.17 1.15.09 2.32-.58 3.04-1.45" />
    </svg>
  );
}
