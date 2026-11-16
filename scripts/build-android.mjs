#!/usr/bin/env node
// Builds the Android app in one go: builds the web app, copies it into the Android project, runs Gradle.
//   pnpm android:apk     debug APK, installed on a plugged-in phone if adb sees one
//   pnpm android:bundle  signed release bundle for Google Play
import { execSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(dirname(fileURLToPath(import.meta.url)));
const android = join(here, "android");
const home = homedir();
const win = process.platform === "win32";
const release = process.argv.includes("--release");

if (release && !existsSync(join(android, "keystore.properties"))) {
  console.error('android/keystore.properties not found: see "Release build for Google Play" in README.md.');
  process.exit(1);
}

const run = (cmd, opts = {}) => {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: here, ...opts });
};
const firstExisting = (paths) => paths.find((p) => p && existsSync(p));

// Android SDK: env var, then the usual install places.
const sdk = firstExisting([
  process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT,
  join(home, "Android", "Sdk"), join(home, "Library", "Android", "sdk"), join(home, "AppData", "Local", "Android", "Sdk"),
]);
if (!sdk) {
  console.error("Android SDK not found. Install Android Studio (it installs the SDK), or set ANDROID_HOME.");
  process.exit(1);
}
writeFileSync(join(android, "local.properties"), `sdk.dir=${sdk.replace(/\\/g, "\\\\")}\n`);

// Java 21: JAVA_HOME if set, else the one bundled with Android Studio.
const env = { ...process.env, ANDROID_HOME: sdk };
if (!process.env.JAVA_HOME) {
  const jbr = firstExisting([
    "/opt/android-studio/jbr", join(home, "android-studio", "jbr"), "/snap/android-studio/current/jbr",
    join(home, ".local", "share", "JetBrains", "Toolbox", "apps", "android-studio", "jbr"),
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home", "C:\\Program Files\\Android\\Android Studio\\jbr",
  ]);
  if (jbr) env.JAVA_HOME = jbr;
}
console.log(`Android SDK: ${sdk}\nJava: ${env.JAVA_HOME ?? "from PATH"}`);

run("pnpm exec vite build");
run("pnpm exec cap sync android");
const gradle = (task) => run(`${win ? "gradlew.bat" : "sh gradlew"} ${task}`, { cwd: android, env });

if (release) {
  gradle("bundleRelease");
  const out = join(here, "tarot-points.aab");
  copyFileSync(join(android, "app", "build", "outputs", "bundle", "release", "app-release.aab"), out);
  console.log(`\nBundle ready: ${out}\nUpload it in Play Console.`);
  process.exit(0);
}

gradle("assembleDebug");

const apk = join(android, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const out = join(here, "tarot-points.apk");
copyFileSync(apk, out);
console.log(`\nAPK ready: ${out}`);

const adb = firstExisting([join(sdk, "platform-tools", win ? "adb.exe" : "adb")]);
const devices = adb ? spawnSync(adb, ["devices"], { encoding: "utf8" }).stdout.split("\n").slice(1).filter((l) => /\tdevice$/.test(l)) : [];
if (adb && devices.length) {
  run(`"${adb}" install -r "${out}"`);
  console.log("\nInstalled on your phone. Open “Tarot Points”.");
} else {
  console.log("\nTo install: plug your phone in with USB debugging on and run this again,\nor send the APK to your phone (Drive, e-mail…) and open it there.");
}
