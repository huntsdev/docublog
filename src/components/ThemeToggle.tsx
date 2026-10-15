import { useCallback, useEffect, useRef, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, Monitor, Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';
const storageKey = 'hunts-theme';
const options = [
  { value: 'light' as const, label: 'Light', Icon: Sun },
  { value: 'dark' as const, label: 'Dark', Icon: Moon },
  { value: 'system' as const, label: 'System', Icon: Monitor },
];

function readTheme(): Theme {
  try {
    const value = window.localStorage.getItem(storageKey);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch { /* The toggle still works when browser storage is unavailable. */ }
  return 'system';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');
  const [isDark, setIsDark] = useState(false);
  const themeRef = useRef<Theme>('system');

  const updateAppearance = useCallback((value: Theme) => {
    const dark = value === 'dark' || (value === 'system' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    setIsDark(dark);
  }, []);

  useEffect(() => {
    const saved = readTheme();
    themeRef.current = saved;
    setTheme(saved);
    updateAppearance(saved);
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const onSystemChange = () => {
      if (themeRef.current === 'system') updateAppearance('system');
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey && event.key !== null) return;
      const value = readTheme();
      themeRef.current = value;
      setTheme(value);
      updateAppearance(value);
    };
    media?.addEventListener('change', onSystemChange);
    window.addEventListener('storage', onStorage);
    return () => {
      media?.removeEventListener('change', onSystemChange);
      window.removeEventListener('storage', onStorage);
    };
  }, [updateAppearance]);

  const selectTheme = (value: string) => {
    if (value !== 'light' && value !== 'dark' && value !== 'system') return;
    themeRef.current = value;
    setTheme(value);
    updateAppearance(value);
    try { window.localStorage.setItem(storageKey, value); } catch { /* Keep the current session preference. */ }
  };

  return <DropdownMenu.Root>
    <DropdownMenu.Trigger asChild><button className="theme-trigger" type="button" aria-label={`Color theme: ${theme}. Change theme`} title="Change color theme">{isDark ? <Moon size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />}</button></DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content className="theme-menu" sideOffset={9} align="end" collisionPadding={12}>
        <DropdownMenu.Label className="theme-menu-label">Appearance</DropdownMenu.Label>
        <DropdownMenu.RadioGroup value={theme} onValueChange={selectTheme}>
          {options.map(({ value, label, Icon }) => <DropdownMenu.RadioItem className="theme-option" key={value} value={value}><Icon size={16} aria-hidden="true" /><span>{label}</span><DropdownMenu.ItemIndicator className="theme-option-check"><Check size={15} aria-hidden="true" /></DropdownMenu.ItemIndicator></DropdownMenu.RadioItem>)}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>;
}
