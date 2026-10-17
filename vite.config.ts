import { defineConfig } from 'vite';

export default defineConfig({
  // relative asset URLs so the build works from any subpath (GitHub Pages serves it under /warzone-td/)
  base: './',
  build: { target: 'es2022' },
});
