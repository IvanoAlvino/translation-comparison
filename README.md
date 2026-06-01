# Translation comparison

A minimal Angular web app for blind A/B comparison of **agency** vs **AI** translations.
Participants enter their name, pick a language, and choose their preferred translation for each
text — without ever knowing which side is which. Results are downloaded as JSON and aggregated
locally in an admin page. **No backend.**

## How it works

- **`/`** — participant enters name + language, then steps through every text for that language.
  The English source is shown on top; the two translations sit side by side (A/B), with the
  left/right side and the order of texts randomized per session.
- **`/results`** — at the end, the participant downloads a result file and sends it to you.
- **`/admin`** — you upload one or more result files and see combined stats (overall, by language,
  by participant). Everything is processed in-browser; nothing is uploaded.

## Providing the translation data

Replace `public/translations.json` with your real data. Schema:

```json
{
  "languages": [
    {
      "code": "es",
      "name": "Spanish",
      "items": [
        {
          "id": "es-001",
          "source": "The English source text.",
          "agency": "Official agency translation.",
          "ai": "AI-generated translation."
        }
      ]
    }
  ]
}
```

- Each item has exactly one `agency` and one `ai` translation. Participants never see these labels.
- Include only the languages you have data for — the app reads them dynamically.
- Language codes in use: `es` Spanish, `fr` French, `zh` Chinese (Simplified),
  `zh-tw` Chinese (Traditional), `ja` Japanese, `cs` Czech, `de` German. Source is always English.
- ~20–30 items per language is the expected size.

## Result file format (auto-generated on download)

```json
{
  "participant": "Jane Doe",
  "language": "es",
  "languageName": "Spanish",
  "startedAt": "2026-06-01T10:00:00.000Z",
  "completedAt": "2026-06-01T10:08:00.000Z",
  "choices": [
    { "itemId": "es-001", "chosen": "ai", "leftWas": "agency", "msSpent": 4200 }
  ],
  "summary": { "total": 20, "aiPreferred": 11, "agencyPreferred": 7, "ties": 2 }
}
```

`chosen` is the system the participant preferred — `"ai"`, `"agency"`, or `"tie"` (the participant
clicked "Both are good"). `leftWas` records which system was on the left so position bias can be
checked. In the admin view, the AI win rate is `(AI + ties) ÷ all comparisons` — a "Both are good"
tie counts as an AI win (equal quality already justifies switching to AI). Ties are still stored
and reported separately so the raw split stays visible.

## Develop

```bash
npm install
npm start          # ng serve → http://localhost:4200
```

## Build & deploy (static host)

```bash
npm run build      # outputs to dist/translation-comparison/browser
```

Deploy the contents of `dist/translation-comparison/browser` to any static host (GitHub Pages,
Netlify, etc.).

- **SPA fallback:** routes like `/admin` need the host to serve `index.html` for unknown paths.
  Netlify: add a `_redirects` file with `/* /index.html 200`. GitHub Pages: copy `index.html` to
  `404.html`.
- **Sub-path hosting** (e.g. GitHub Pages project sites at `/<repo>/`): build with
  `npm run build -- --base-href=/<repo>/`. Data is fetched relative to the base href, so it works.
