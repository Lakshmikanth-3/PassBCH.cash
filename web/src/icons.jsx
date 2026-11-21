import React from 'react';

// Small line-icon set (no emoji). All icons inherit the text colour.
const S = ({ size = 22, children, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{children}</svg>
);
export const Rock = (p) => <S {...p}><path d="M7 11V8.5a1.5 1.5 0 0 1 3 0V11" /><path d="M10 10V7.5a1.5 1.5 0 0 1 3 0V10" /><path d="M13 10V8a1.5 1.5 0 0 1 3 0v3" /><path d="M16 10.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1.5A5.5 5.5 0 0 1 6 14.5V12a1.5 1.5 0 0 1 3 0" /></S>;
export const Paper = (p) => <S {...p}><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12" /><path d="M11 11.5V4a1.5 1.5 0 0 1 3 0v7.5" /><path d="M14 11.5V5.5a1.5 1.5 0 0 1 3 0V13" /><path d="M17 9.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.6a6 6 0 0 1-4.7-2.3L4.4 15.6a1.5 1.5 0 0 1 2.3-1.9L8 15" /></S>;
export const Scissors = (p) => <S {...p}><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4 8.1 15.9" /><path d="M14.5 14.5 20 20" /><path d="M8.1 8.1 12 12" /></S>;
export const Chart = (p) => <S {...p}><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 6-6" /><path d="M16 8h4v4" /></S>;
export const Agents = (p) => <S {...p}><rect x="3" y="8" width="7" height="8" rx="2" /><rect x="14" y="8" width="7" height="8" rx="2" /><path d="M6.5 8V5M17.5 8V5" /><path d="M10 12h4" /><path d="M5.5 12h0M8 12h0M16 12h0M18.5 12h0" /></S>;
export const Hourglass = (p) => <S {...p}><path d="M6 3h12M6 21h12" /><path d="M7 3c0 5 5 6 5 9s-5 4-5 9" /><path d="M17 3c0 5-5 6-5 9s5 4 5 9" /></S>;
export const Wallet = (p) => <S {...p}><path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15v14H5a2 2 0 0 1-2-2V5" /><circle cx="16" cy="14" r="1.2" /></S>;
export const Grid = (p) => <S {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></S>;
export const Logout = (p) => <S {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></S>;
export const Trophy = (p) => <S {...p}><path d="M8 21h8M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" /></S>;
export const Key = (p) => <S {...p}><circle cx="7.5" cy="15.5" r="4.5" /><path d="m11 12 9-9M17 6l3 3M15 8l2 2" /></S>;
export const Terminal = (p) => <S {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7 9 3 3-3 3M13 15h4" /></S>;
export const Bolt = (p) => <S {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></S>;
export const Swords = (p) => <S {...p}><path d="M14.5 17.5 3 6V3h3l11.5 11.5" /><path d="m13 19 6-6M16 16l4 4M19 21l2-2" /><path d="M9.5 6.5 14 2h3v3l-4.5 4.5" /></S>;
export const MOVE_ICON = { rock: Rock, paper: Paper, scissors: Scissors };
export const MoveIcon = ({ move, ...p }) => { const I = MOVE_ICON[move]; return I ? <I {...p} /> : <span>?</span>; };

export const Coin = (p) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.5c0-1 1-1.7 2.5-1.7s2.5.7 2.5 1.7-1 1.5-2.5 1.7-2.5.7-2.5 1.8 1 1.7 2.5 1.7 2.5-.7 2.5-1.7" /></S>;
export const Keyboard = (p) => <S {...p}><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7 14h10" /></S>;
