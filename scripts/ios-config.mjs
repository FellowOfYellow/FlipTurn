// Copies the iOS Google client ID from .env into the Xcode project's
// Info.plist, so Google's sign-in screen can hand the coach back to the app.
// Runs as part of `npm run ios`.
import { readFileSync, writeFileSync } from 'node:fs'

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8')
const clientId = env.match(/^VITE_GOOGLE_IOS_CLIENT_ID=(.*)$/m)?.[1]?.trim()
if (!clientId) {
  console.warn('VITE_GOOGLE_IOS_CLIENT_ID is empty in .env, so Google sign-in is off in the iOS app.')
  process.exit(0)
}

// Google's callback scheme is the client ID written backwards:
// 123-abc.apps.googleusercontent.com -> com.googleusercontent.apps.123-abc
const scheme = clientId.split('.').reverse().join('.')
const plistUrl = new URL('../ios/App/App/Info.plist', import.meta.url)
let plist = readFileSync(plistUrl, 'utf8')

const block = `\t<!-- flipturn:google-start -->
\t<key>GIDClientID</key>
\t<string>${clientId}</string>
\t<key>CFBundleURLTypes</key>
\t<array>
\t\t<dict>
\t\t\t<key>CFBundleURLSchemes</key>
\t\t\t<array>
\t\t\t\t<string>${scheme}</string>
\t\t\t</array>
\t\t</dict>
\t</array>
\t<!-- flipturn:google-end -->
`
plist = plist.replace(/\t<!-- flipturn:google-start -->[\s\S]*?<!-- flipturn:google-end -->\n/, '')
const end = plist.lastIndexOf('</dict>')
plist = plist.slice(0, end) + block + plist.slice(end)
writeFileSync(plistUrl, plist)
console.log(`Info.plist: Google sign-in callback set to ${scheme}`)
