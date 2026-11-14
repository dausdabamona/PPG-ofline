import type { CapacitorConfig } from '@capacitor/cli'

// Satu APK untuk semua peran (pengurus, mubaligh, generus, wali). WebView dilayani dari https://localhost
// sehingga WebCrypto (PBKDF2) dan IndexedDB tersedia.
const config: CapacitorConfig = {
  appId: 'id.ppgsorong.app',
  appName: 'PPG Sorong',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
}

export default config
