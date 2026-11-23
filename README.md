# Studio

Batch photo and PDF tools that run entirely in your browser. Files never leave your computer.

- **Photos**: resize, square-crop, compress, add a watermark, download a ZIP.
- **PDF**: merge, shrink (re-render pages as JPEG, which also strips hidden text and metadata), add a watermark.

Free: 5 files per batch and a small "flisk studio" mark on the output.
Unlock: one Stripe Payment Link, no accounts, no database.

## Unlock

Set `PAYMENT_LINK` and the redirect in `public/index.html`. In Stripe, set the Payment Link's
after-payment redirect to `https://<host>/?unlocked=<UNLOCK_TOKEN>`. The page stores the unlock in
`localStorage`. This is an honour-system gate (anyone can read the token from the page source); it
suits a $9-$19 tool, not a licence you must protect.

## Run

    bunx wrangler@4 dev      # local preview
    bunx wrangler@4 deploy   # publish
