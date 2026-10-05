import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize } from "@capacitor/keyboard";

const config: CapacitorConfig = {
  appId: "com.priyatiarraapp.poseforme",
  appName: "poseforme",
  webDir: "out",
  backgroundColor: "#FBF8F3",
  ios: {
    // Full-screen web view; the layout pads for the notch and home bar with env(safe-area-inset-*).
    contentInset: "never",
    backgroundColor: "#FBF8F3",
    // No long-press link previews.
    allowsLinkPreview: false,
  },
  plugins: {
    // Dark status-bar text on the paper background.
    StatusBar: { style: "LIGHT" },
    // The keyboard slides over the app without resizing it, so layouts (and their stickers)
    // stay exactly as designed. iOS still scrolls a field into view if the keyboard covers it.
    Keyboard: { resize: KeyboardResize.None },
    CapacitorSQLite: { iosDatabaseLocation: "Library/CapacitorDatabase", iosIsEncryption: false },
  },
};

export default config;
