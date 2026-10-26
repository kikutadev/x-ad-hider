import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'X Ad Hider',
    description: 'Hide promoted posts on X without collecting data.',
    version: '0.1.0',
    // Declarative content scripts only: no background worker or data collection.
    permissions: [],
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
  },
});
