# Android Setup

This project uses Capacitor and the Android platform is generated via the Capacitor CLI.

## Initial add

From the project root:

```bash
npx cap add android
```

This creates:

- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/res/`
- `android/app/build.gradle`
- `android/build.gradle`

## Android manifest requirements

In `android/app/src/main/AndroidManifest.xml`:

- Add required permissions under `<manifest>` before `<application>`:
  - `android.permission.INTERNET`
  - `android.permission.CAMERA`
  - `android.permission.VIBRATE`
  - `android.permission.RECEIVE_BOOT_COMPLETED`
  - `android.permission.POST_NOTIFICATIONS`
  - `android.permission.READ_MEDIA_IMAGES`
  - `android.permission.WRITE_EXTERNAL_STORAGE` with `android:maxSdkVersion="28"`
- Ensure `MainActivity` in `<application>` includes:
  - `android:exported="true"`
  - `android:launchMode="singleTask"`
  - `android:theme="@style/AppTheme.NoActionBarLaunch"`
  - `android:screenOrientation="portrait"`
  - `android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"`

## App name and package strings

In `android/app/src/main/res/values/strings.xml`:

- `<string name="app_name">Atlas</string>`
- `<string name="title_activity_main">Atlas</string>`
- `<string name="package_name">com.atlasperformancelabs.app</string>`
- `<string name="custom_url_scheme">com.atlasperformancelabs.app</string>`

## Sync and open

After native updates:

```bash
npx cap sync android
npx cap open android
```

## Network Security Configuration

Added `android/app/src/main/res/xml/network_security_config.xml` and referenced it from `AndroidManifest.xml` (`android:networkSecurityConfig`) to control cleartext (HTTP) on Android 9+ (API 28+). Production API hosts are pinned to **HTTPS-only**; **localhost** and **10.0.2.2** (emulator host loopback) allow cleartext for local Vite / Capacitor live reload.

If you test on a **physical device** against a machine on your LAN, add your computer’s IP as a `<domain>` inside the dev `domain-config` block with `cleartextTrafficPermitted="true"`, then run `npx cap sync android` again.

## Git note

`android/` is currently not excluded by `.gitignore` in this repo.
