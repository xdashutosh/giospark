# GIO Spark — website

Static website for **GIO Spark** packaged drinking water with added minerals (Chaudhary Enterprises).
Three pages, no build step: upload the files and it works.

| Page | What's on it |
| --- | --- |
| `index.html` | 3D bottle hero (fill + cap intro, 200 ml / 500 ml / 1 L switcher with the poster taglines), scroll story *From source to sealed* (RO → UV → Ozonation → Minerals → Sealed), poster feature band, about, values, moments, products, launch-poster gallery, business, distributor CTA |
| `enquiry.html` | Business enquiry form (type, sizes, quantity, distributor-only fields, contact details), 3D bottle that follows the chosen size, FAQ |
| `contact.html` | Call / WhatsApp / email / directions cards, contact form, Google Map |

## Preview locally

Opening `index.html` directly works. For the closest match to the live site, run a local server from this folder:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

(VS Code's *Live Server* extension works too.)

## Deploy on Vercel

The project is ready for Vercel as-is: no build step and no `package.json`.

- `vercel.json` adds security headers and image/library caching, and caps the form function at 15 s.
- `.vercelignore` uploads only the website: the HTML pages, `assets/`, `api/`, `404.html`, `robots.txt`, `sitemap.xml` and `vercel.json`. Your `.docx`, `Logo.rar`, the WhatsApp photo, `source/`, `tools/`, `send.php` and this README stay private.
- `.gitignore` keeps the private source files out of Git, if you deploy from GitHub.

1. **Deploy.** Choose one:
   - **CLI:** run `npx vercel` in this folder, then `npx vercel --prod`.
   - **GitHub:** push this folder to a repository and import it at vercel.com/new. Framework preset: **Other**. Leave the build and output settings empty.
2. **Plan.** Vercel's free *Hobby* plan is for non-commercial use only, so a business site needs the **Pro** plan.
3. **Domain.** In Vercel → Project → Settings → Domains, add `giospark.com` (and `www.giospark.com`), then create the DNS records Vercel shows at your domain registrar. **Keep your existing MX records**, or `info@giospark.com` will stop receiving mail.
4. **Email for the forms.** See the next section.
5. **Check it.** After deploying, these should return 404:
   - `https://giospark.com/send.php`
   - `https://giospark.com/Logo.rar`
   - `https://giospark.com/README.md`

If the domain is not `giospark.com`, update the `canonical` and `og:` URLs in each page's `<head>`, and the URLs in `robots.txt` and `sitemap.xml`.

## Forms (enquiry + contact)

The forms send JSON to `/api/send` (`api/send.js`, a Vercel Function). It emails each submission to `info@giospark.com` through **[Resend](https://resend.com)** (free plan: 100 emails/day, 3,000/month).

1. Create a Resend account and an API key.
2. In Vercel → Project → Settings → Environment Variables, add `RESEND_API_KEY` for **Production** and **Preview**, then **redeploy**. Variables only apply to new deployments.
3. Pick a sender:
   - **Quick start:** sign up to Resend *with* `info@giospark.com` and keep the default sender `onboarding@resend.dev`. It only delivers to that sign-up address.
   - **Proper setup:**
     1. In Resend → Domains, add `giospark.com`.
     2. Add the DNS records Resend shows at your registrar: `resend._domainkey` TXT, plus `send` MX and `send` TXT.
     3. Set `MAIL_FROM` to e.g. `GIO Spark Website <website@giospark.com>`.
     4. Do **not** enable Resend "Receiving" on the root domain, because it would take over the domain's incoming mail.
4. Optional: set `MAIL_TO` to change the recipient. Separate several addresses with commas.

What the function protects against:
- It validates the name and the 10-digit Indian mobile number.
- It ignores bot submissions caught by the hidden honeypot field.
- It rejects posts from other websites.
- It slows down repeated bursts.

If email isn't set up yet, or sending fails, nothing is lost. Visitors see an **"Almost done"** screen with one-tap **Send on WhatsApp** / **Send by email** buttons, with their details already filled in.

**Other hosts:** `send.php` does the same job with PHP `mail()` on cPanel / Hostinger / GoDaddy. Set `formEndpoint: 'send.php'` in `assets/js/config.js` and change the forms' `action` to `send.php`.

Validation: name, 10-digit Indian mobile number, city and enquiry type are required; a hidden honeypot field blocks simple spam bots.

Links can pre-fill the enquiry form:

- `enquiry.html?type=distributor` — also `retail`, `corporate`, `hospitality`, `events`, `home`, `other`
- `enquiry.html?product=500` — also `200`, `1000`

## Editing content

- **Text:** edit the HTML files directly. The header, footer and icon sprite are repeated in all three pages, so update phone/email/address in each.
- **Phone, WhatsApp, email used by scripts:** `assets/js/config.js`.
- **3D bottle:** recreated from the launch posters (`source/gio-spark-posters.jpeg`):
  - square PET body with an embossed tile grid and a royal-blue cap;
  - navy front wrapper with a gold frame (`drawLabel()` in `assets/js/bottle.js`);
  - sizes and proportions are in `SPECS` at the top of the same file.
- **Hero colours and copy per size** (including the poster stickers such as “Easy to carry anywhere!”): `THEMES` and `COPY` at the top of `assets/js/home.js`.
- **Launch posters:** `assets/img/poster-*.jpg` are cut from the poster sheet. Swap in higher-resolution files with the same names whenever you have them.
- **Product images:** `assets/img/bottle-*.png` are renders of the same 3D bottle. Replace them with real product photos (transparent PNG) whenever you have them.

## How it's built

- **GSAP 3.15** — ScrollTrigger (pinned scroll story, horizontal gallery, reveals), SplitText (headline reveals), CustomEase.
- **Three.js** (trimmed bundle in `assets/vendor/three.min.js`) for the 3D PET bottle:
  - custom shaders for the clear plastic, water, bubbles, mineral sparkles, RO membrane and UV scan;
  - the label is drawn on a canvas.
- **Lenis** smooth scrolling.
- Everything is self-hosted in `assets/vendor/`; only Google Fonts and the Google Map load from outside.
- **Fallbacks:** visitors without WebGL, or with “reduce motion” turned on, get static bottle images and a plain step list.

To rebuild the Three.js bundle (only needed when upgrading Three.js):

```bash
npm i three esbuild
npx esbuild tools/three-entry.js --bundle --format=iife --global-name=THREE --minify --outfile=assets/vendor/three.min.js
```
