import { HTMLAttributes, useMemo, useState } from 'react';
import { MenuArea, MenuItem } from './chatTypes';

interface ChatMenuProps {
  areas: MenuArea[];
  /** Open straight into this area's options (when the user taps the area pill) */
  initialAreaId?: string | null;
  isMobile: boolean;
  /** Pointer handlers that let the header drag the sheet on a phone */
  dragProps?: HTMLAttributes<HTMLDivElement>;
  onPick: (area: MenuArea, item: MenuItem) => void;
  onClose: () => void;
}

const headerStyle = {
  background: 'linear-gradient(135deg, #1b1307 0%, #2d2110 100%)', color: '#f3c13a', flexShrink: 0,
} as const;

const backButtonStyle = {
  background: 'none', border: 'none', color: '#f3c13a', fontSize: 15, fontWeight: 700, minHeight: 40, padding: '0 8px', cursor: 'pointer',
} as const;

// Two levels: area tiles, then the area's options. Picking an option closes the menu and hands
// it to the chat, which asks any questions as chips.
export function ChatMenu({ areas, initialAreaId, isMobile, dragProps, onPick, onClose }: ChatMenuProps) {
  const [areaId, setAreaId] = useState<string | null>(initialAreaId ?? null);
  const area = areas.find(a => a.id === areaId) ?? null;

  // Options in the order given, grouped under a small heading when they carry one
  const groups = useMemo(() => {
    if (!area) return [];
    const out: { name: string | null; items: MenuItem[] }[] = [];
    for (const item of area.items) {
      const name = item.group ?? null;
      const last = out[out.length - 1];
      if (last && last.name === name) last.items.push(item); else out.push({ name, items: [item] });
    }
    return out;
  }, [area]);

  return (
    <div className="chat-work" role="region" aria-label="Menu">
      <div className={isMobile ? 'chat-grab' : undefined} {...(isMobile ? dragProps : {})} style={headerStyle}>
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 0' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(243,193,58,0.6)' }} />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px 6px', minHeight: 46 }}>
          {area
            ? <button type="button" style={backButtonStyle} onPointerDown={e => e.stopPropagation()} onClick={() => setAreaId(null)}>‹ Menu</button>
            : <span style={{ width: 56 }} />}
          <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700 }}>
            {area ? `${area.icon} ${area.label}` : 'What do you want to do?'}
          </div>
          <button type="button" style={{ ...backButtonStyle, width: 56, fontSize: 22 }} aria-label="Close menu" onPointerDown={e => e.stopPropagation()} onClick={onClose}>×</button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', background: '#f7f5ef', padding: 12 }}>
        {!area && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {areas.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAreaId(a.id)}
                style={{
                  minHeight: 84, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                  background: '#fff', border: '1px solid var(--border, #e5e0d5)', borderRadius: 14, cursor: 'pointer',
                  fontSize: 14, fontWeight: 700, color: 'var(--text, #1b1307)', WebkitTapHighlightColor: 'rgba(243,193,58,0.3)',
                }}
              >
                <span style={{ fontSize: 26, lineHeight: 1 }} aria-hidden="true">{a.icon}</span>
                {a.label}
              </button>
            ))}
          </div>
        )}

        {area && groups.map((g, gi) => (
          <div key={gi} style={{ marginBottom: 10 }}>
            {g.name && <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--muted, #8a7d65)', margin: '4px 4px 6px' }}>{g.name}</div>}
            <div style={{ background: '#fff', border: '1px solid var(--border, #e5e0d5)', borderRadius: 12, overflow: 'hidden' }}>
              {g.items.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onPick(area, item)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', minHeight: 48, padding: '0 14px',
                    background: '#fff', border: 'none', borderTop: i ? '1px solid var(--border, #e5e0d5)' : 'none',
                    fontSize: 15, fontWeight: 600, color: 'var(--text, #1b1307)', textAlign: 'left', cursor: 'pointer',
                    WebkitTapHighlightColor: 'rgba(243,193,58,0.3)',
                  }}
                >
                  <span>{item.label}</span>
                  <span style={{ color: 'var(--muted, #8a7d65)', fontSize: 13 }} aria-hidden="true">{item.type === 'guide' ? '✎' : '›'}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
