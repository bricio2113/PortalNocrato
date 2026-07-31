// Espelha o tailwind.config inline do index.html, para o harness renderizar
// com os mesmos estilos que o app usa em producao via CDN.
module.exports = {
  darkMode: 'class',
  content: ['./components/**/*.tsx', './harness/**/*.{tsx,html}', './App.tsx'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      colors: {
        brand: { gold: '#FABE01', dark: '#111111', card: '#1A1A1A', border: 'rgba(255,255,255,0.05)' },
        surface: { base: '#111111', raised: '#1A1A1A', sunken: '#0D0D0D', hover: '#212121' }
      },
      borderRadius: { card: '1.25rem', control: '0.75rem', chip: '0.5rem' },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -12px rgba(0,0,0,0.6)',
        glow: '0 0 0 1px rgba(250,190,1,0.2), 0 8px 24px -8px rgba(250,190,1,0.25)'
      }
    }
  }
};
