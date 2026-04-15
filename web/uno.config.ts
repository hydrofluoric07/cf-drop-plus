import { presetIcons } from '@unocss/preset-icons';
import { presetUno } from '@unocss/preset-uno';
import type { UserConfig } from '@unocss/core';
import chroma from 'chroma-js';
import LucideIcons from '@iconify-json/lucide/icons.json' assert { type: 'json' };

import manifest from './public/manifest.json';

const brandColor = manifest.theme_color;
const colorScale = chroma.scale(['#fff', brandColor, '#000']).mode('oklch').colors(10);

const unoConfig: UserConfig = {
  shortcuts: {
    'center-child': 'flex justify-center items-center',
    'col-center': 'flex flex-col justify-center items-center',
    'row-center': 'flex flex-row justify-center items-center',
  },
  theme: {
    colors: {
      brand: {
        DEFAULT: brandColor,
        1: colorScale[1],
        2: colorScale[2],
        3: colorScale[3],
        4: colorScale[4],
        5: colorScale[5],
        6: colorScale[6],
        7: colorScale[7],
        8: colorScale[8],
        9: colorScale[9],
      },
    },
  },
  presets: [
    presetUno(),
    presetIcons({
      extraProperties: {
        display: 'inline-block',
        'vertical-align': 'middle',
        'flex-shrink': '0',
        // ...
      },
      collections: {
        lucide: () => LucideIcons,
      },
    }),
  ],
};

export default unoConfig;
