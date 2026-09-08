import React from 'react';

/** Серая «реплика» игрока во время торговли. */
export function Bubble({
  text,
  x,
  y,
  tail = 'down-left',
  dark,
}: {
  text: string;
  x: number;
  y: number;
  tail?: 'down-left' | 'up-left';
  dark?: boolean;
}) {
  return (
    <div className={`bubble tail-${tail}${dark ? ' dark-bid' : ''}`} style={{ left: x, top: y }}>
      {text}
      <span className="tail" />
    </div>
  );
}

/** Информационное окно с подсказками (голубой прямоугольник с заклёпками). */
export function InfoBox({ text, x, y }: { text: string; x: number; y: number }) {
  return (
    <div className="infobox" style={{ left: x, top: y }}>
      <span className="rivet" style={{ left: 2, top: 2 }} />
      <span className="rivet" style={{ right: 2, top: 2 }} />
      <span className="rivet" style={{ left: 2, bottom: 2 }} />
      <span className="rivet" style={{ right: 2, bottom: 2 }} />
      <span style={{ whiteSpace: 'pre-line' }}>{text}</span>
    </div>
  );
}

/** Значок бочки возле имени игрока. */
export function BarrelIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ verticalAlign: 'middle' }}>
      <ellipse cx="8" cy="8" rx="5" ry="7" fill="#b06a20" stroke="#000" />
      <rect x="3" y="4" width="10" height="1.4" fill="#000" />
      <rect x="3" y="10.6" width="10" height="1.4" fill="#000" />
      <ellipse cx="8" cy="8" rx="5" ry="7" fill="none" stroke="#000" />
    </svg>
  );
}
