import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.blockparty.game',
  appName: 'Block Party',
  webDir: 'dist',
  android: {
    backgroundColor: '#f8f7f4',
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
