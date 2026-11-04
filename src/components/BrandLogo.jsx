import { useEffect, useState } from 'react';
import SoftGlowLogo from '@/components/SoftGlowLogo';

const LIGHT_LOGO = 'https://media.base44.com/images/public/6ab11d37ba4cf09ddd77f163/fccd64662_LIGHTMOREFASTAMPSLOGO.png';

function readTheme() {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export default function BrandLogo({ className = '' }) {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    setTheme(readTheme());
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  if (theme === 'dark') {
    return (
      <SoftGlowLogo
        variant="nav"
        className={`brand-logo-img object-contain shrink-0 ${className}`}
      />
    );
  }

  return (
    <img
      src={LIGHT_LOGO}
      alt="FastAmps — Simply Reliable"
      className={`brand-logo-img object-contain shrink-0 ${className}`}
    />
  );
}
