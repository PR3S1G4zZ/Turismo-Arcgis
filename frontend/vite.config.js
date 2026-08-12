import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    // El portal usa CSS vanilla, sin PostCSS. Se declara la configuración vacía
    // de forma explícita porque, si no, Vite busca un postcss.config.* subiendo
    // por el árbol de directorios y puede acabar tomando el de otro proyecto
    // ajeno al repositorio (p. ej. uno con Tailwind en C:\), lo que rompe la
    // compilación con "Cannot find module '@tailwindcss/postcss'".
    postcss: {},
  },
})
