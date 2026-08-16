Real FieldCalls logo files, wired into the app. To apply on top of your existing
fieldcalls checkout:

1. Copy these files into your repo at the same paths (overwriting where they exist):
   public/favicon-512.png
   public/favicon-32.png
   public/apple-touch-icon.png
   public/logo-wordmark.png
   public/logo-full.png
   public/logo-wordmark-white.png
   public/manifest.json   (overwrite)
   src/components/constants.jsx   (overwrite)
   index.html   (overwrite)

2. Delete the old placeholder: rm public/logo.svg

3. git add -A && git commit -m "Add real FieldCalls logo assets" && git push

Also: vercel.json  (overwrite) — fixed the cron schedule from hourly to once daily
(0 12 UTC). The Vercel free/Hobby plan only allows daily cron jobs; the hourly
ticket-reminders cron from PartSync caused the first deploy to fail.
