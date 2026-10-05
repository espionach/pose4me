"use client";

import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import { StatusBar, Style } from "@capacitor/status-bar";
import { useEffect } from "react";

/**
 * iOS app only: dark status-bar text on our paper background, no web-form bar (˄ ˅ done)
 * above the keyboard, and the `native` class that turns off browser-only behaviour (text
 * selection and long-press callouts) — see globals.css.
 */
export function NativeSetup() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    document.documentElement.classList.add("native");
    StatusBar.setStyle({ style: Style.Light }).catch(() => {}); // Light = dark text, for light backgrounds
    Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});
  }, []);
  return null;
}
