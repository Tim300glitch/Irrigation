# DeltaLine Irrigation — Landing Page

A one-page website for DeltaLine Irrigation built with React, Vite, Tailwind CSS and Lucide icons. It's a static site with no database or server, so it runs on Netlify's or Vercel's free plan.

```bash
cd website
npm install
npm run dev       # local preview at http://localhost:5173
npm run build     # production files in website/dist
```

## What to edit

| What                                     | Where                                                   |
| ---------------------------------------- | ------------------------------------------------------- |
| Phone number, service area, form email   | `src/config.js`                                         |
| Photos                                   | `src/config.js` → `images` (see “Photos” below)         |
| Page title, Google description, schema   | `index.html`                                            |
| Section text                             | `src/components/*.jsx` (one file per section)           |

---

## 1. Publish (pick one, about 5 minutes)

The website lives in the **`website`** folder of this repository. Point the host at that folder.

### Netlify (free)

1. Go to <https://app.netlify.com> and sign in with GitHub.
2. Click **Add new site → Import an existing project → GitHub** and pick the `Irrigation` repository.
3. Fill in the settings:
   - **Branch to deploy:** the branch with this site (merge it into `main` first if you like)
   - **Base directory:** `website`
   - **Build command:** `npm run build` (filled in automatically from `netlify.toml`)
   - **Publish directory:** `website/dist`
4. Under **Environment variables**, add `VITE_FORM_EMAIL` = the email address that should receive estimate requests (see section 3).
5. Click **Deploy**. In about a minute you get a live address like `deltaline-irrigation.netlify.app`. You can rename it under **Site configuration → Change site name**.

### Vercel (free)

1. Go to <https://vercel.com/new> and sign in with GitHub.
2. Import the `Irrigation` repository.
3. Set **Root Directory** to `website`. Vercel detects Vite automatically.
4. Under **Environment Variables**, add `VITE_FORM_EMAIL` = your email address.
5. Click **Deploy**. You get an address like `deltaline-irrigation.vercel.app`.

After that, every push to the deployed branch republishes the site automatically.

> If you change `VITE_FORM_EMAIL` later, trigger a new deploy (Netlify: **Deploys → Trigger deploy**; Vercel: **Deployments → Redeploy**). The value is built into the site.

---

## 2. Connect your own domain later

1. Buy a domain (for example `deltalineirrigation.com`) from any registrar, such as Cloudflare, Namecheap, Porkbun or GoDaddy.
2. Add it to your host:
   - **Netlify:** Site → **Domain management → Add a domain**
   - **Vercel:** Project → **Settings → Domains → Add**
3. The host shows you one or two DNS records, usually an `A` record for the bare domain and a `CNAME` for `www`. Add them in your registrar's DNS settings. You can also switch your nameservers to Netlify's if you used Netlify.
4. Wait for DNS to update (usually minutes, sometimes a few hours). HTTPS is set up for free automatically.
5. Optional, once the domain works: add these lines to `index.html` inside `<head>`, replacing the domain with yours:
   ```html
   <link rel="canonical" href="https://www.yourdomain.com/" />
   <meta property="og:url" content="https://www.yourdomain.com/" />
   ```
   Also add `"url": "https://www.yourdomain.com/"` to the LocalBusiness block in the same file.

---

## 3. Turn on the estimate form (FormSubmit — free, no account)

The form sends requests through [FormSubmit.co](https://formsubmit.co) to your inbox.

1. Set `VITE_FORM_EMAIL` to your email address, either in the Netlify or Vercel settings (step 4 above) or directly in `src/config.js`. Then deploy.
2. Open your **live** site and send a test request through the form.
   - The first submission is **not delivered**. Instead, FormSubmit emails you a message titled something like “Action Required: Activate FormSubmit”. The website tells the visitor that the request didn't go through and asks them to call. It never shows a false “success” message.
3. Open that email and click **Activate Form**. Check your spam folder if it isn't there.
4. Send another test from the live site. It should now arrive in your inbox as a neat table (name, phone, ZIP, service, details), and the site shows “Thank you — request received.”
5. Recommended: FormSubmit's activation email also gives you a **random alias** (a string like `a1b2c3d4…`). Use it in place of your email as the `VITE_FORM_EMAIL` value and redeploy. That keeps your real email address out of the website code.

**If `VITE_FORM_EMAIL` is empty**, the form still validates the visitor's entries. It then tells them online requests aren't switched on yet and shows the call button, so you never lose a lead without knowing.

The form uses a hidden “honeypot” field to filter basic spam bots. If you run into spam later, FormSubmit also supports a reCAPTCHA. See their docs.

---

## 4. Photos

The page uses three free photos from Unsplash under the [Unsplash License](https://unsplash.com/license), which allows commercial use with no attribution required:

- Hero: <https://unsplash.com/photos/6DMht7wYt6g> (sprinkler spraying a green lawn)
- Water section: <https://unsplash.com/photos/-zbcx0Lvsfw> (impact sprinkler on a lawn, Paul Moody)
- Why Choose Us (desktop only): <https://unsplash.com/photos/y_ibWWpOiL0> (lawn in front of a home, Mike Von)

If a photo ever fails to load, the site shows a clean navy panel in its place, never a broken-image icon.

**Using your own photos** (recommended once you have job photos, which build the most trust):

1. Save them in `website/public/images/`, for example `hero.jpg`, ideally about 2000px wide and under 400 KB. [Squoosh](https://squoosh.app) compresses them for free.
2. In `src/config.js`, replace the photo's `unsplashId: '…'` with `src: '/images/hero.jpg'`.
3. Update the `alt` text to describe the new photo.

---

## Pre-launch checklist

- [ ] `VITE_FORM_EMAIL` set, form activated, and a test request received
- [ ] Tap **Call Now** on your phone and confirm it dials (916) 426-3004
- [ ] Look over the site on your phone after deploying
- [ ] Optional: create a free [Google Business Profile](https://business.google.com) and link it to the site. This matters a lot for local Sacramento searches.
