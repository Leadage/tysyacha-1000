import React, { useState } from 'react';
import { Button, Checkbox, Fieldset, NumberInput, Window } from '../Win98';
import { DEFAULT_UI, UiSettings } from '../../game/settings';

const FIELD_COLORS = [
  { label: 'Классический зелёный', value: '#3a9a3a' },
  { label: 'Тёмно-зелёный', value: '#008000' },
  { label: 'Тёмно-синий', value: '#004080' },
  { label: 'Бордовый', value: '#800020' },
  { label: 'Серый', value: '#5a5a5a' },
];

export function SettingsDialog({
  ui,
  onOk,
  onCancel,
}: {
  ui: UiSettings;
  onOk: (u: UiSettings) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState<UiSettings>({ ...ui });
  const set = <K extends keyof UiSettings>(k: K, v: UiSettings[K]) => setD((x) => ({ ...x, [k]: v }));

  return (
    <Window title="Настройки" onClose={onCancel} style={{ width: 620 }}>
      <div className="w98-dialog-body" style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Fieldset legend="Подтверждения:">
            <Checkbox checked={d.confirmDark} onChange={(v) => set('confirmDark', v)} label="При игре втемную" />
            <Checkbox
              checked={d.confirmSameContract}
              onChange={(v) => set('confirmSameContract', v)}
              label="При неизменении заказа"
            />
            <Checkbox
              checked={d.confirmLowBarrelContract}
              onChange={(v) => set('confirmLowBarrelContract', v)}
              label="При недостаточном заказе на бочке"
            />
            <Checkbox
              checked={d.confirmNoMarriage}
              onChange={(v) => set('confirmNoMarriage', v)}
              label="При невозможности объявить марьяж"
            />
          </Fieldset>

          <Fieldset legend="При нажатии на Escape:">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 12 }}>Менять название на</span>
              <input
                className="w98-input"
                style={{ flex: 1 }}
                value={d.escapeTitle}
                onChange={(e) => set('escapeTitle', e.target.value)}
              />
            </div>
          </Fieldset>

          <Fieldset legend="Автоматизация:">
            <Checkbox checked={d.autoClick} onChange={(v) => set('autoClick', v)} label="Автоматический щелчок" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 12, flex: 1 }}>Задержка для взятки (мсек):</span>
              <NumberInput value={d.trickDelayMs} onChange={(v) => set('trickDelayMs', v)} min={0} max={5000} step={100} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 12, flex: 1 }}>Задержка для прикупа (мсек):</span>
              <NumberInput value={d.talonDelayMs} onChange={(v) => set('talonDelayMs', v)} min={0} max={10000} step={100} />
            </div>
          </Fieldset>
        </div>

        <div style={{ width: 250 }}>
          <Fieldset legend="Показывать:">
            <Checkbox
              checked={d.showTableLegend}
              onChange={(v) => set('showTableLegend', v)}
              label="Расшифровку в таблице"
            />
            <Checkbox
              checked={d.showReplayButton}
              onChange={(v) => set('showReplayButton', v)}
              label="Кнопку повтора"
            />
            <Checkbox checked={d.showPassButton} onChange={(v) => set('showPassButton', v)} label="Кнопку Пас" />
            <Checkbox checked={d.sound} onChange={(v) => set('sound', v)} label="Звук" />
          </Fieldset>

          <Fieldset legend="Оформление:">
            <div style={{ fontSize: 12, marginBottom: 3 }}>Цвет игрового поля</div>
            <select
              className="w98-select"
              style={{ width: '100%' }}
              value={d.tableColor}
              onChange={(e) => set('tableColor', e.target.value)}
            >
              {FIELD_COLORS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <div
              style={{
                height: 46,
                marginTop: 6,
                background: d.tableColor,
                border: '1px solid #000',
              }}
            />
            <div style={{ fontSize: 12, margin: '6px 0 3px' }}>Фоновое изображение (URL)</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                className="w98-input"
                style={{ flex: 1 }}
                value={d.backgroundImage}
                onChange={(e) => set('backgroundImage', e.target.value)}
              />
              <Button small onClick={() => set('backgroundImage', '')}>
                ✕
              </Button>
            </div>
          </Fieldset>

          <Fieldset legend="Имя игрока:">
            <input
              className="w98-input"
              style={{ width: '100%' }}
              value={d.playerName}
              onChange={(e) => set('playerName', e.target.value)}
            />
          </Fieldset>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '0 10px 10px', background: '#c0c0c0' }}>
        <Button onClick={() => setD({ ...DEFAULT_UI })}>По умолчанию</Button>
        <Button onClick={() => onOk(d)}>OK</Button>
        <Button onClick={onCancel}>Отмена</Button>
      </div>
    </Window>
  );
}
