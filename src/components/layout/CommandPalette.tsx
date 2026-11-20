import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Search } from 'lucide-react';
import { COMMANDS, searchCommands, type Command } from '@/lib/commands';
import { isTypingTarget, openCapture, useAppEvent } from '@/lib/appEvents';
import { useLoadedProfile, useUpdateProfile } from '@/features/profile/queries';
import { applyTheme } from '@/features/profile/theme';
import { useAppLock } from '@/features/lock/lockContext';
import { cn } from '@/utils/cn';

/**
 * Ctrl/⌘+K (or "/") opens a search over every page and common action;
 * "C" opens quick capture. Arrow keys move, Enter runs, Esc closes.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  const show = useCallback(() => setOpen(true), []);
  useAppEvent('steady:palette', show);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target) || document.querySelector('dialog[open]')) return;
      if (e.key === '/') {
        e.preventDefault();
        setOpen(true);
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        openCapture();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label="Search Steady"
      onCancel={(e) => {
        e.preventDefault();
        setOpen(false);
      }}
      onClick={(e) => e.target === ref.current && setOpen(false)}
      className="m-0 mx-auto mt-[8vh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-sheet bg-panel p-0 text-ink shadow-lift backdrop:bg-black/40 backdrop:backdrop-blur-sm open:animate-scale-in"
    >
      {open && <PaletteBody onClose={() => setOpen(false)} />}
    </dialog>
  );
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const profile = useLoadedProfile();
  const update = useUpdateProfile();
  const lock = useAppLock();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  const available = useMemo(
    () =>
      COMMANDS.filter(
        (c) => (!c.modules || c.modules.some((m) => !profile.disabled_modules.includes(m))) && (c.action !== 'lock' || lock.enabled),
      ),
    [profile.disabled_modules, lock.enabled],
  );
  const results = useMemo(() => searchCommands(available, q).slice(0, 12), [available, q]);
  const safeActive = Math.min(active, Math.max(0, results.length - 1));

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [safeActive]);

  const run = (c: Command) => {
    onClose();
    if (c.to) navigate(c.to);
    else if (c.action === 'capture') openCapture();
    else if (c.action === 'lock') lock.lockNow();
    else if (c.action === 'theme') {
      const dark = document.documentElement.classList.contains('dark');
      const theme = dark ? 'light' : 'dark';
      applyTheme(theme);
      update.mutate({ theme });
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-border px-5">
        <Search className="h-5 w-5 shrink-0 text-muted" aria-hidden />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results[safeActive] ? `${listId}-${safeActive}` : undefined}
          aria-label="Search pages and actions"
          placeholder="Search pages and actions…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => (a + 1) % Math.max(1, results.length));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => (a - 1 + results.length) % Math.max(1, results.length));
            } else if (e.key === 'Enter' && results[safeActive]) {
              e.preventDefault();
              run(results[safeActive]);
            }
          }}
          className="h-16 min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-muted focus-visible:!ring-0 focus-visible:!ring-offset-0"
        />
        <kbd className="kbd hidden sm:inline-flex">Esc</kbd>
      </div>
      <ul id={listId} ref={listRef} role="listbox" aria-label="Results" className="max-h-[50vh] overflow-y-auto p-2">
        {results.length === 0 && <li className="px-4 py-8 text-center text-muted">Nothing matches “{q}”.</li>}
        {results.map((c, i) => {
          const Icon = c.icon;
          const showGroup = i === 0 || results[i - 1].group !== c.group;
          return (
            <li key={c.id} role="presentation">
              {showGroup && <p className="px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-wider text-muted">{c.group}</p>}
              <div
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === safeActive}
                onMouseMove={() => setActive(i)}
                onClick={() => run(c)}
                className={cn(
                  'flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl px-3',
                  i === safeActive ? 'bg-accent-soft text-ink' : 'text-ink',
                )}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-accent-ink">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="flex-1 font-medium">{c.label}</span>
                {i === safeActive && <CornerDownLeft className="h-4 w-4 text-muted" aria-hidden />}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="hidden items-center gap-3 border-t border-border px-5 py-3 text-xs text-muted sm:flex">
        <span>
          <kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> to move
        </span>
        <span>
          <kbd className="kbd">Enter</kbd> to open
        </span>
        <span className="ml-auto">
          <kbd className="kbd">C</kbd> quick capture
        </span>
      </p>
    </div>
  );
}
