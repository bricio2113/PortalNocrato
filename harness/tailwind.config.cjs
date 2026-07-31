// Espelha o tailwind.config inline do index.html, para o harness renderizar
// com os mesmos estilos que o app usa em producao via CDN.
module.exports = {
  darkMode: 'class',
  content: ['./components/**/*.tsx', './harness/**/*.{tsx,html}', './App.tsx'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      colors: { brand: { gold: '#FABE01', dark: '#111111', card: '#1A1A1A', border: 'rgba(255,255,255,0.05)' } }
    }
  }
};
