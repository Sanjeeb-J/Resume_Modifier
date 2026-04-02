# Resume Builder

Full-stack Resume Builder with React, Tailwind CSS, Express-based parsing, a protected Gemini backend, and PDF/DOCX export.

## Local setup

1. Install dependencies:
   `npm install`
2. Add your Gemini secret to `.env`.
3. Start both apps:
   `npm run dev`
4. Open the frontend URL shown by Vite.

## Deployment notes

- Gemini calls now run through the backend, not the browser.
- Set `GEMINI_API_KEY` and optionally `GEMINI_MODEL` in Vercel project environment variables.
- Vercel routes `/api/*` to the serverless backend and serves the built frontend from `client/dist`.
