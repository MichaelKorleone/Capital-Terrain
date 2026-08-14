# Capital Terrain

Capital Terrain is a prototype financial visualization app for exploring S&P 500 market-cap repricing.

It shows:

- A daily market capitalization repricing bar chart
- A 3D market-cap terrain field grouped by sector
- Historical preset terrain views
- A dated market terrain traveler
- Search, hover, pinned labels, zoom, pan, and reset controls

Important concept: market-cap change is a valuation repricing of ownership claims. It is not literal cash flowing into or out of a company.

## Run Locally

```bash
npm start
```

Then open:

```text
http://127.0.0.1:4173/
```

The app uses free public data sources for exploratory visualization:

- DataHub S&P 500 financials
- Yahoo public chart endpoint
- Historical S&P 500 constituent files
- Local mock data fallback

Because this is a prototype, historical market cap uses a current-share-count proxy. Treat it as a visual research tool, not audited financial data.

## Tests

```bash
node --test test/*.test.js
```

## Deploy

Use a Node-capable host, not static-only GitHub Pages, because the app has API routes in `server.js`.

Render setup:

- Service type: Web Service
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`

The server reads the host platform's `PORT` value automatically.
