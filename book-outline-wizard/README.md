# Book Outline Wizard

A guided, step-by-step wizard that helps new technical authors create a complete book outline.
Built with MkDocs + Material theme and deployed to GitHub Pages.

---

## Screenshot

> _Screenshot placeholder — add an image of the wizard UI here once deployed._

---

## What It Does

Before the questionnaire starts, the user authenticates with GitHub and chooses whether to
create a new book project or continue an existing one.

For each new book, the wizard creates a dedicated repository in the authenticated user's own
GitHub account, then continuously writes section and chapter Markdown files into that repo.

The wizard walks an author through seven key sections:

1. **About the Author** — professional bio with live character counter
2. **The Book's Goal** — title, subtitle, audience, USP, and learning promise
3. **Competitive Book Titles** — analysis of up to three competing books
4. **Learning Outcomes** — up to seven measurable reader outcomes
5. **Parts & Chapters** — organise the book into as many parts and chapters as needed
6. **Detailed Chapter Outline** — per-chapter descriptions, page counts, sub-headings, and optional image uploads
7. **Community Outreach** _(optional)_ — technical reviewers, Amazon reviewers, and influencers

Progress is saved automatically in browser `localStorage` and synced to the user's GitHub repo.
When finished, the author can still download a ZIP archive of Markdown files ready to share
with an editor or publisher.

---

## Local Development

### Prerequisites

- Python 3.12+
- pip

### Setup

```bash
cd book-outline-wizard
pip install -r requirements.txt
mkdocs serve
```

Open <http://127.0.0.1:8000> in your browser.

---

## Deployment

The site is deployed automatically to GitHub Pages via GitHub Actions whenever changes are
pushed to the `main` branch.

To trigger a manual deployment:

1. Go to the **Actions** tab in GitHub.
2. Select the **Deploy MkDocs to GitHub Pages** workflow.
3. Click **Run workflow**.

The built site will be published to the `gh-pages` branch and served from the repository's
GitHub Pages URL.

---

## Tech Stack

- [MkDocs](https://www.mkdocs.org/) 1.6.1: Static site generator
- [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/) 9.7.6: Theme
- [JSZip](https://stuk.github.io/jszip/) 3.10.1: Client-side ZIP generation (CDN)
- Vanilla JavaScript (ES5): Wizard logic
- CSS3: Custom styles
- GitHub Actions: CI/CD
- GitHub Pages: Hosting

---

## File Structure

```text
book-outline-wizard/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions: build & deploy
├── docs/
│   ├── index.md                # Landing page
│   ├── wizard.md               # The wizard single-page app
│   ├── guide.md                # User guide
│   ├── javascripts/
│   │   ├── questions.js        # All section/field definitions
│   │   ├── storage.js          # localStorage helpers
│   │   ├── export.js           # Markdown generation & ZIP download
│   │   └── wizard.js           # Core wizard UI & navigation
│   ├── stylesheets/
│   │   └── custom.css          # Custom theme overrides
│   └── assets/
│       └── favicon.ico
├── mkdocs.yml                  # MkDocs configuration
├── requirements.txt            # Python dependencies
└── README.md                   # This file
```

---

## License

MIT — see [LICENSE](../LICENSE) for details.
