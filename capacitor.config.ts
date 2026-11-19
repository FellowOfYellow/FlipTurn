import type { CapacitorConfig } from '@capacitor/cli'

// The App Store version wraps the same web app. Build it with `npm run ios`.
const config: CapacitorConfig = {
  appId: 'com.fellowofyellow.flipturn',
  appName: 'FlipTurn',
  webDir: 'dist',
  plugins: {
    SocialLogin: {
      providers: { google: true, facebook: false, apple: false, twitter: false },
      logLevel: 1,
    },
  },
}

export default config
