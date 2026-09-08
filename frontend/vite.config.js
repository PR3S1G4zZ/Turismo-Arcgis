import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Permite probar desde un teléfono por un único túnel HTTPS de ngrok:
    // las llamadas relativas /api se reenvían al backend local sin exponer
    // otro origen ni depender de CORS entre dos URLs públicas.
    host: '0.0.0.0',
    allowedHosts: ['skyward-gains-quicksand.ngrok-free.dev'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
  css: {
    // El portal usa CSS vanilla, sin PostCSS. Se declara la configuración vacía
    // de forma explícita porque, si no, Vite busca un postcss.config.* subiendo
    // por el árbol de directorios y puede acabar tomando el de otro proyecto
    // ajeno al repositorio (p. ej. uno con Tailwind en C:\), lo que rompe la
    // compilación con "Cannot find module '@tailwindcss/postcss'".
    postcss: {},
  },
})
