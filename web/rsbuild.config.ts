import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { configRsPack } from './rspack.config';
import { pluginSass } from '@rsbuild/plugin-sass';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export default defineConfig({
  html: {
    template: './template.html',
    title: 'cf-drop',
    templateParameters: {
      publicPath: '/',
    },
  },
  plugins: [
    pluginSass({
      sassLoaderOptions: {
        api: 'modern',
        implementation: require.resolve('sass'),
      },
    }),
    pluginReact(),
  ],
  tools: {
    rspack: configRsPack,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
});
