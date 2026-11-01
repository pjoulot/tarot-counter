import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";

/** On the phone app, use the system share sheet and back button; in a browser, fall back to web features. */
export const isNative = Capacitor.isNativePlatform();

export async function setupBackButton(): Promise<void> {
  if (!isNative) return;
  const { App } = await import("@capacitor/app");
  await App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else void App.exitApp();
  });
}

/** Returns false if nothing could share (the caller then copies to the clipboard). */
export async function shareText(text: string): Promise<boolean> {
  if (isNative) {
    const { Share } = await import("@capacitor/share");
    await Share.share({ text });
    return true;
  }
  if (navigator.share) {
    await navigator.share({ text });
    return true;
  }
  return false;
}

/** Save a file: a download in the browser, the share sheet (Drive, e-mail, Files…) on the phone. */
export async function saveFile(name: string, text: string, mime: string): Promise<void> {
  if (isNative) {
    const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const res = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: name, files: [res.uri] });
    return;
  }
  const blob = new Blob([text], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Dark status-bar icons on the cream theme, light ones on the dark theme. */
export function setSystemBars(dark: boolean): void {
  if (!isNative) return;
  void SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => undefined);
}
