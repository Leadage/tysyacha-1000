import React, { useState } from 'react';
import { Button, Checkbox, NumberInput, Window } from '../Win98';
import {
  DEFAULT_RULES,
  RULE_GROUPS,
  RULE_META,
  RuleSettings,
  SettingMeta,
  normalizeRules,
} from '../../game/settings';

export function RulesDialog({
  rules,
  onOk,
  onCancel,
  locked,
}: {
  rules: RuleSettings;
  onOk: (r: RuleSettings) => void;
  onCancel: () => void;
  locked: boolean;
}) {
  const [draft, setDraft] = useState<RuleSettings>({ ...rules });
  const [group, setGroup] = useState(RULE_GROUPS[0]);
  const [hint, setHint] = useState<SettingMeta | null>(null);

  const items = RULE_META.filter((m) => m.group === group);

  function set<K extends keyof RuleSettings>(id: K, v: RuleSettings[K]) {
    setDraft((d) => ({ ...d, [id]: v }));
  }

  return (
    <Window title="Договорённости" onClose={onCancel} style={{ width: 690 }}>
      <div className="w98-dialog-body" style={{ display: 'flex', gap: 8 }}>
        <div className="w98-list w98-scroll" style={{ width: 132, height: 372 }}>
          {RULE_GROUPS.map((g) => (
            <div
              key={g}
              className={`w98-list-row${g === group ? ' selected' : ''}`}
              onClick={() => setGroup(g)}
            >
              {g}
            </div>
          ))}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            className="w98-inset w98-scroll"
            style={{ height: 268, padding: 6, background: '#c0c0c0' }}
          >
            {items.map((m) => (
              <RuleRow
                key={String(m.id)}
                meta={m}
                draft={draft}
                set={set as any}
                onHover={() => setHint(m)}
              />
            ))}
          </div>
          <div
            className="w98-inset"
            style={{ height: 78, padding: 6, fontSize: 12, lineHeight: 1.4, background: '#ffffe1', overflow: 'auto' }}
          >
            {hint ? (
              <>
                <b>{hint.title}</b>
                <br />
                {hint.description}
              </>
            ) : (
              'Наведите указатель на договорённость, чтобы прочитать её описание.'
            )}
          </div>
          <div style={{ fontSize: 11, color: '#800000' }}>
            Количество игроков и золотой кон применяются со следующей партии — игра предложит начать её.
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
          padding: '0 10px 10px',
          background: '#c0c0c0',
        }}
      >
        <Button onClick={() => setDraft({ ...DEFAULT_RULES })}>Классические</Button>
        <Button onClick={() => onOk(normalizeRules(draft))}>OK</Button>
        <Button onClick={onCancel}>Отмена</Button>
      </div>
    </Window>
  );
}

function RuleRow({
  meta,
  draft,
  set,
  onHover,
}: {
  meta: SettingMeta;
  draft: RuleSettings;
  set: (id: keyof RuleSettings, v: any) => void;
  onHover: () => void;
}) {
  const value = draft[meta.id] as any;

  if (meta.type === 'bool') {
    return (
      <Checkbox
        checked={!!value}
        onChange={(v) => set(meta.id, v)}
        label={meta.title}
        onHover={onHover}
      />
    );
  }

  if (meta.type === 'number') {
    return (
      <div
        className="w98-check"
        onMouseEnter={onHover}
        style={{ justifyContent: 'space-between', paddingRight: 8 }}
      >
        <span>{meta.title}</span>
        <NumberInput
          value={Number(value)}
          onChange={(v) => set(meta.id, v)}
          min={meta.min}
          max={meta.max}
          step={meta.step}
          width={68}
        />
      </div>
    );
  }

  return (
    <div
      className="w98-check"
      onMouseEnter={onHover}
      style={{ justifyContent: 'space-between', paddingRight: 8 }}
    >
      <span>{meta.title}</span>
      <select
        className="w98-select"
        value={String(value)}
        onChange={(e) => {
          const opt = meta.options!.find((o) => String(o.value) === e.target.value)!;
          set(meta.id, opt.value);
        }}
      >
        {meta.options!.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
