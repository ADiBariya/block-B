import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.blockparty.game',
  appName: 'Block Party',
  webDir: 'dist',
  android: {
    backgroundColor: '#d9b7f8',
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      style: 'LIGHT',
      hidden: false,
    },
  },
};

export default config;
