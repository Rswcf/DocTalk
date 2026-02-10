import { useTheme } from 'next-themes';

export function useWin98Theme() {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === 'win98';
}
