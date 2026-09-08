import React, { useEffect, useState } from 'react';

/**
 * Портрет персонажа. Если файла в public/characters нет — рисуем
 * временный силуэт, не меняя размеры и положение.
 */
export function Portrait({
  src,
  name,
  x,
  y,
  width,
  height,
  showName = true,
  nameBelow = true,
}: {
  src: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  showName?: boolean;
  nameBelow?: boolean;
}) {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => !cancelled && setOk(true);
    img.onerror = () => !cancelled && setOk(false);
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div className="portrait" style={{ left: x, top: y, width }}>
      {ok ? (
        <img src={src} alt={name} style={{ width, height, objectFit: 'contain' }} />
      ) : (
        <Silhouette width={width} height={height} />
      )}
      {showName && nameBelow && <div className="portrait-name">{name}</div>}
    </div>
  );
}

function Silhouette({ width, height }: { width: number; height: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 100 140">
      {/* волосы */}
      <path
        d="M22,44 Q20,10 50,8 Q80,10 78,44 Q72,26 50,24 Q28,26 22,44 Z"
        fill="#f2c800"
        stroke="#000"
        strokeWidth="2"
      />
      {/* голова */}
      <ellipse cx="50" cy="48" rx="27" ry="29" fill="#f2d648" stroke="#000" strokeWidth="2" />
      <circle cx="40" cy="44" r="10" fill="#fff" stroke="#000" strokeWidth="2" />
      <circle cx="61" cy="44" r="10" fill="#fff" stroke="#000" strokeWidth="2" />
      <circle cx="41" cy="45" r="3.2" fill="#000" />
      <circle cx="60" cy="45" r="3.2" fill="#000" />
      <path d="M40,62 Q50,70 61,62" fill="none" stroke="#000" strokeWidth="2" />
      {/* шея */}
      <rect x="45" y="74" width="10" height="12" fill="#f2d648" stroke="#000" strokeWidth="2" />
      {/* плечи */}
      <path d="M18,140 L18,102 Q50,84 82,102 L82,140 Z" fill="#d84a2a" stroke="#000" strokeWidth="2" />
      <path d="M42,140 L42,92 Q50,88 58,92 L58,140" fill="#d84a2a" stroke="#000" strokeWidth="2" />
    </svg>
  );
}
