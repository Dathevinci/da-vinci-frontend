# Da Vinci — Android app (APK)

This folder is a **Trusted Web Activity (TWA)**: a tiny native wrapper whose only
job is to open **https://www.dathevinci.xyz** fullscreen, with no browser bar.
Because it loads the live site, the app **updates itself** on every Vercel deploy
— you only rebuild the APK when the shell (name/icon/URL) changes.

GitHub Actions (`.github/workflows/android-apk.yml`) builds a **signed** `.apk`
and attaches it to a GitHub Release whenever you push a `v*` tag.

---

## One-time setup (≈10 minutes)

You do this once. It needs the `keytool` command, which ships with any Java JDK
(`java -version` to check; if missing, install Temurin/OpenJDK 17).

### 1. Create a signing key

> ⚠️ Keep this file **forever** and back it up. If you lose it you can still ship
> APKs with a *new* key, but anyone who installed the old one must uninstall
> first (Android refuses to update an app when the signature changes).

```bash
keytool -genkeypair -v \
  -keystore da-vinci-release.keystore \
  -alias davinci \
  -keyalg RSA -keysize 2048 -validity 10000
```

It asks for a **keystore password**, a **key password** (you can reuse the same
one), and your name/org (any values are fine). Remember both passwords.

### 2. Base64-encode the keystore (so it can live in a GitHub secret)

- **Windows (PowerShell):**
  ```powershell
  [Convert]::ToBase64String([IO.File]::ReadAllBytes("da-vinci-release.keystore")) | Set-Content -NoNewline keystore.b64.txt
  ```
- **macOS / Linux:**
  ```bash
  base64 -w0 da-vinci-release.keystore > keystore.b64.txt   # macOS: base64 -i da-vinci-release.keystore -o keystore.b64.txt
  ```

### 3. Add 4 repository secrets

GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret name | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the entire contents of `keystore.b64.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password from step 1 |
| `ANDROID_KEY_ALIAS` | `davinci` |
| `ANDROID_KEY_PASSWORD` | the key password from step 1 |

### 4. Publish your key's fingerprint (removes the URL bar)

Get the signing certificate's SHA-256:

```bash
keytool -list -v -keystore da-vinci-release.keystore -alias davinci
```

Copy the long `SHA256: AA:BB:CC:…` hex string, then paste it into
[`public/.well-known/assetlinks.json`](../public/.well-known/assetlinks.json),
replacing `REPLACE_WITH_YOUR_KEYSTORE_SHA256_FINGERPRINT`. Commit + push so it
deploys to `https://www.dathevinci.xyz/.well-known/assetlinks.json`.

> Skipping step 4 still gives a working app — it just shows a thin address bar at
> the top instead of being fully immersive. Do it once and the bar disappears.

---

## Cut a release (every time you want a new APK)

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow builds the signed APK and attaches `da-vinci-1.0.0.apk` to the
**v1.0.0 GitHub Release**. Share that release link — friends download the `.apk`,
tap it, allow "install from unknown sources," and it installs.

(Prefer a dry run first? Actions tab → **Build Android APK** → **Run workflow** →
it builds and uploads the APK as a downloadable *artifact* without making a
release.)

---

## What's here

| File | Purpose |
|---|---|
| `app/src/main/AndroidManifest.xml` | Declares the TWA `LauncherActivity` + the site it opens |
| `app/src/main/res/values/strings.xml` | The launch URL + asset-links statement |
| `app/src/main/res/values/{colors,styles}.xml` | Brand colour + launch theme |
| `app/src/main/res/mipmap-*` | App icons (generated from `public/logo.png`) |
| `app/build.gradle` | App id `xyz.dathevinci.twa`, signing wired to the secrets above |

To change the app **name**, edit `appName` in `strings.xml`. To change the
**site** it opens, edit `launchUrl` (and the host in `AndroidManifest.xml`,
`assetStatements`, and `assetlinks.json`).

## Want it on the Google Play Store later?

Same project — build an **AAB** instead (`gradle bundleRelease`) and upload it in
the Play Console. Ask and I'll add a `bundleRelease` job + the Play-signing notes.
