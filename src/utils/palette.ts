import type { Gender } from '../types';

export interface Palette {
  fill: string;
  border: string;
  accent: string;
  avFill: string;
  avText: string;
  pillBg: string;
  pillColor: string;
  glyph: string;
  genderName: string;
}

export function palette(gender: Gender): Palette {
  if (gender === 'Male') return {
    fill: '#F0F9FF', border: '#38BDF8', accent: '#0369A1',
    avFill: '#BAE6FD', avText: '#075985',
    pillBg: '#E0F2FE', pillColor: '#075985',
    glyph: '♂', genderName: 'Male',
  };
  if (gender === 'Female') return {
    fill: '#FDF2F8', border: '#F472B6', accent: '#BE185D',
    avFill: '#FBCFE8', avText: '#9D174D',
    pillBg: '#FCE7F3', pillColor: '#9D174D',
    glyph: '♀', genderName: 'Female',
  };
  return {
    fill: '#FAFAF9', border: '#A8A29E', accent: '#57534E',
    avFill: '#E7E5E4', avText: '#44403C',
    pillBg: '#F0EDE9', pillColor: '#44403C',
    glyph: '⚥', genderName: 'Other',
  };
}
