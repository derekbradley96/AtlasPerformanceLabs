# Logo image 1

**File:** `logo-image-1.png` (used by `AtlasLogo.jsx` everywhere: header, splash, auth, etc.)

## Use your transparent PNG here

The app only uses the file **in this folder**: `src/assets/logo-image-1.png`. If your “Logo image 1” in Finder shows **Alpha channel: Yes** but the app still shows a black background, the app is still using an older copy (e.g. JPEG data with a .png name).

**Do this:**

1. In Finder, locate your **Logo image 1.png** (the one that shows **Alpha channel: Yes** in Get Info).
2. Copy that file into this folder:  
   `Atlas-Performance-labs-app_/src/assets/`
3. When prompted, **replace** the existing `logo-image-1.png` (so your PNG-with-alpha becomes the one the app uses).
4. Optional check in Terminal (from the project root):  
   `file src/assets/logo-image-1.png`  
   It should say **“PNG image data”** and **“RGBA”** (or “8-bit/color RGBA”), not “JPEG”.
5. Rebuild and sync: `npm run build` then `npx cap sync ios`, then run from Xcode.

After that, the app will use your transparent logo.
