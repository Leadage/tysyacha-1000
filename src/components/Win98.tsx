import React, { useEffect, useRef, useState } from 'react';

// ------------------------------------------------------------------ кнопка

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { small?: boolean },
) {
  const { small, className, ...rest } = props;
  return <button {...rest} className={`w98-btn${small ? ' small' : ''} ${className || ''}`} />;
}

// ------------------------------------------------------------------ чекбокс

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  onHover,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  onHover?: () => void;
}) {
  return (
    <div
      className="w98-check"
      onMouseEnter={onHover}
      onClick={() => !disabled && onChange(!checked)}
      style={disabled ? { color: '#808080' } : undefined}
    >
      <span className={`w98-check-box${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}`} />
      <span>{label}</span>
    </div>
  );
}

export function Radio({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <div className="w98-check" onClick={onChange}>
      <span className={`w98-radio${checked ? ' checked' : ''}`} />
      <span>{label}</span>
    </div>
  );
}

// ------------------------------------------------------------------ окно

export function Window({
  title,
  children,
  onClose,
  width,
  style,
  icon,
}: {
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
  width?: number;
  style?: React.CSSProperties;
  icon?: React.ReactNode;
}) {
  return (
    <div className="w98-window" style={{ width, ...style }}>
      <div className="w98-titlebar">
        {icon}
        <span className="w98-titlebar-text">{title}</span>
        <div className="w98-titlebar-buttons">
          {onClose && (
            <button className="w98-sysbtn" onClick={onClose} title="Закрыть">
              ✕
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ MessageBox

export function MessageBox({
  title,
  text,
  onOk,
  onCancel,
  okLabel = 'OK',
  cancelLabel = 'Отмена',
  icon = '!',
}: {
  title: string;
  text: React.ReactNode;
  onOk: () => void;
  onCancel?: () => void;
  okLabel?: string;
  cancelLabel?: string;
  icon?: '!' | '?' | 'i';
}) {
  return (
    <Window title={title} onClose={onCancel || onOk} style={{ minWidth: 300, maxWidth: 420 }}>
      <div className="w98-dialog-body">
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '10px 6px 18px' }}>
          <MsgIcon kind={icon} />
          <div style={{ fontSize: 12, lineHeight: 1.45, paddingTop: 6 }}>{text}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
          <Button autoFocus onClick={onOk}>
            {okLabel}
          </Button>
          {onCancel && <Button onClick={onCancel}>{cancelLabel}</Button>}
        </div>
      </div>
    </Window>
  );
}

function MsgIcon({ kind }: { kind: '!' | '?' | 'i' }) {
  if (kind === '!') {
    return (
      <svg width="32" height="32" viewBox="0 0 32 32" style={{ flex: '0 0 32px' }}>
        <polygon points="16,2 31,29 1,29" fill="#ffdf00" stroke="#000" strokeWidth="1" />
        <rect x="14" y="10" width="4" height="10" fill="#000" />
        <rect x="14" y="22" width="4" height="4" fill="#000" />
      </svg>
    );
  }
  if (kind === '?') {
    return (
      <svg width="32" height="32" viewBox="0 0 32 32" style={{ flex: '0 0 32px' }}>
        <circle cx="16" cy="16" r="14" fill="#0000a0" stroke="#000" />
        <text x="16" y="24" fontSize="20" fill="#fff" textAnchor="middle" fontWeight="bold">
          ?
        </text>
      </svg>
    );
  }
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" style={{ flex: '0 0 32px' }}>
      <circle cx="16" cy="16" r="14" fill="#0000a0" stroke="#000" />
      <text x="16" y="24" fontSize="20" fill="#fff" textAnchor="middle" fontWeight="bold">
        i
      </text>
    </svg>
  );
}

// ------------------------------------------------------------------ меню

export interface MenuEntry {
  label: string;
  action?: () => void;
  disabled?: boolean;
  separator?: boolean;
  shortcut?: string;
  checked?: boolean;
}

export interface MenuDef {
  title: string;
  entries: MenuEntry[];
}

export function MenuBar({ menus }: { menus: MenuDef[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open === null) return;
    const h = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div className="w98-menubar" ref={barRef}>
      {menus.map((m, i) => (
        <div key={m.title} style={{ position: 'relative' }}>
          <div
            className={`w98-menu-item${open === i ? ' open' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              setOpen(open === i ? null : i);
            }}
            onMouseEnter={() => open !== null && setOpen(i)}
          >
            {m.title}
          </div>
          {open === i && (
            <div className="w98-menu-popup" style={{ left: 0 }}>
              {m.entries.map((en, j) =>
                en.separator ? (
                  <div className="w98-menu-sep" key={j} />
                ) : (
                  <div
                    key={j}
                    className={`w98-menu-row${en.disabled ? ' disabled' : ''}`}
                    onClick={() => {
                      if (en.disabled) return;
                      setOpen(null);
                      en.action?.();
                    }}
                  >
                    {en.checked && <span className="check">✓</span>}
                    <span>{en.label}</span>
                    {en.shortcut && <span style={{ opacity: 0.8 }}>{en.shortcut}</span>}
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ группа

export function Fieldset({
  legend,
  children,
  style,
}: {
  legend: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <fieldset className="w98-fieldset" style={style}>
      <legend>{legend}</legend>
      {children}
    </fieldset>
  );
}

// ------------------------------------------------------------------ числовое поле

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  width = 60,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  width?: number;
}) {
  return (
    <input
      className="w98-input"
      type="number"
      style={{ width }}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (Number.isNaN(v)) return;
        onChange(v);
      }}
    />
  );
}
