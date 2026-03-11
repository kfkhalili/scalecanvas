# Todo / roadmap

## 1. Difficulty picker for new session

- When the user starts a new session, add a **difficulty picker** (e.g. Easy / Medium / Hard).
- Use the picker to filter the question bank (`lib/questions.ts`) by `difficulty` when choosing the opening topic.
- Only present questions that match the selected difficulty for that session.

## 2. Increase stray/warning count before session end

- Increase the number of **warnings** the user gets before the session is ended (e.g. for going off-topic) from **1 to 3**.
- Update prompts and/or chat/termination logic so the interviewer warns three times before calling `terminate_interview`.

## 3. About / Impressum / contact and payment disputes

- Add **About** (and **Impressum** where required).
- Add a **help/contact email** for support and for **payment disputes** (e.g. Stripe, refunds).
- Surface this in the UI (e.g. footer, settings, or dedicated About/Help/Contact page).

## 4. User journeys for achievements

- Define and implement **user journeys** that drive **achievements** (e.g. first session, first purchase, N sessions completed, trial completed).
- Design which actions unlock which achievements and how they are displayed or rewarded.

## 5. Isolate company images into library (like awsicons)

- Extract **company images** (e.g. FAANG/brand logos) into a dedicated library, similar to the existing **awsicons** library.
- Centralize assets, exports, and usage so company imagery is consistent and easy to maintain across the app.

## 6. Improve SEO

- Improve **SEO** (meta tags, titles, descriptions, Open Graph, structured data, sitemap, robots) so the site is discoverable and presents well in search and social.
