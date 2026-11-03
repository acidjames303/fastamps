import { useEffect, useState } from 'react';

const LOGOS = {
  dark: 'https://media.base44.com/images/public/6ab11d37ba4cf09ddd77f163/97c7e96ae_DARKMODEFASTAMPSLOGO.png',
  light: 'https://media.base44.com/images/public/6ab11d37ba4cf09ddd77f163/fccd64662_LIGHTMOREFASTAMPSLOGO.png',
};

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

  return (
    <img
      src={LOGOS[theme]}
      alt="FastAmps — Simply Reliable"
      className={`brand-logo-img object-contain shrink-0 ${className}`}
    />
  );
}