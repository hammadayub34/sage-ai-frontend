/**
 * SVG Icon Components - Clean, modern icons to replace emojis
 */

interface IconProps {
  className?: string;
  size?: number;
}

export const DashboardIcon = ({ className = "w-6 h-6", size }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} width={size} height={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" fill="currentColor"/>
  </svg>
);

export const ChatIcon = ({ className = "w-6 h-6", size }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} width={size} height={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="currentColor"/>
  </svg>
);

export const SettingsIcon = ({ className = "w-5 h-5", size }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} width={size} height={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill="currentColor"/>
  </svg>
);

export const ChartIcon = ({ className = "w-5 h-5", size }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} width={size} height={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" fill="currentColor"/>
  </svg>
);

export const TrendingUpIcon = ({ className = "w-5 h-5", size }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} width={size} height={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" fill="currentColor"/>
  </svg>
);

export const LockIcon = ({ className = "w-5 h-5", size }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} width={size} height={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" fill="currentColor"/>
  </svg>
);

export const WrenchIcon = ({ className = "w-5 h-5", size }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} width={size} height={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" fill="currentColor"/>
  </svg>
);

export const DropletIcon = ({ className = "w-5 h-5", size }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} width={size} height={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" fill="currentColor"/>
  </svg>
);

export const CalendarIcon = ({ className = "w-4 h-4", size }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} width={size} height={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" fill="currentColor"/>
  </svg>
);

export const PlayIcon = ({ className = "w-4 h-4", size }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} width={size} height={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M8 5v14l11-7z" fill="currentColor"/>
  </svg>
);

export const StopIcon = ({ className = "w-4 h-4", size }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} width={size} height={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M6 6h12v12H6z" fill="currentColor"/>
  </svg>
);

export const ClockIcon = ({ className = "w-4 h-4", size }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} width={size} height={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" fill="currentColor"/>
  </svg>
);

export const CheckIcon = ({ className = "w-4 h-4", size }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} width={size} height={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/>
  </svg>
);

export const AlertIcon = ({ className = "w-4 h-4", size }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} width={size} height={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="currentColor"/>
  </svg>
);

export const WarningIcon = ({ className = "w-4 h-4", size }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} width={size} height={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="currentColor"/>
  </svg>
);

export const FileIcon = ({ className = "w-4 h-4", size }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} width={size} height={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="currentColor"/>
  </svg>
);

export const ChevronDownIcon = ({ className = "w-3 h-3", size }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} width={size} height={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M7 10l5 5 5-5z" fill="currentColor"/>
  </svg>
);

export const ChevronRightIcon = ({ className = "w-3 h-3", size }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} width={size} height={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" fill="currentColor"/>
  </svg>
);

export const RefreshIcon = ({ className = "w-4 h-4", size }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} width={size} height={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" fill="currentColor"/>
  </svg>
);

export const SearchIcon = ({ className = "w-4 h-4", size }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} width={size} height={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor"/>
  </svg>
);

