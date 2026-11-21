# Dream Football 11 — Android APK

গেমটা ফোনে আসল অ্যাপের মতো ইনস্টল করে খেলার জন্য GitHub Actions দিয়ে
APK বানানোর ব্যবস্থা আছে: `.github/workflows/build-apk.yml`।
APK-টা একটা নেটিভ শেল (Capacitor) — খুললেই পূর্ণ স্ক্রিনে লাইভ গেমটা
লোড হয়, তাই গেম আপডেট হলেই APK-তেও সেই আপডেট পাওয়া যায়, নতুন করে
APK বানাতে হয় না।

## একবারের সেটআপ

1. গেমটার পাবলিশড লিংকটা কপি করো (যে লিংকে গেমটা খোলে)।
2. এই রিপোতে যাও: **Settings → Secrets and variables → Actions →
   Variables → New repository variable**
   - Name: `GAME_URL`
   - Value: গেমের লিংকটা
3. ব্যস — আর কিছু লাগবে না।

## APK বানানো ও ডাউনলোড

1. **Actions** ট্যাবে যাও → **Build Android APK** → **Run workflow**।
   (workflow ফাইলে পুশ হলেও নিজে নিজে একবার চলবে।)
2. বিল্ড শেষ হলে (৫–১০ মিনিট) দুই জায়গায় APK পাবে:
   - ওই রানের নিচে **Artifacts → Dream-Football-11-APK**
   - **Releases → apk-latest** — `Dream-Football-11.apk`
3. ফোনে APK-টা খুলে ইনস্টল করো। প্রথমবার "অজানা অ্যাপ ইনস্টল"-এর
   অনুমতি চাইলে দিয়ে দাও।

## নোট

- এটা debug-signed APK — নিজের ফোনে ইনস্টলের জন্য যথেষ্ট, Play Store-এ
  দেওয়ার জন্য নয়।
- `GAME_URL` সেট না থাকলে workflow লাল হয়ে থামবে আর কী করতে হবে
  লগে লিখে দেবে।
