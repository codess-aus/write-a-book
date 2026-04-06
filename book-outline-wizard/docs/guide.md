# User Guide

This guide explains everything you need to know about using the Book Outline Wizard.

---

## Overview

The wizard walks you through **seven sections** that together form a complete book outline.
You can navigate freely between sections, save your work at any time, and export all
completed sections as a ZIP archive of Markdown files.

---

## Sections Explained

### Section 1 — About the Author
Write a short professional biography (up to 750 characters). Include your background,
expertise, and any previously published books or notable projects. This text will appear
in your outline as `00-about-the-author.md`.

### Section 2 — The Book's Goal
Define the core purpose of your book:

- **Title & Subtitle** — the name of your book and a descriptive sub-title.
- **Target audience** — who your ideal reader is.
- **Prerequisites** — knowledge the reader should have before starting.
- **USP** — why someone should buy *your* book over competing titles.
- **Product breakdown** — a 6–7 sentence journey description.
- **Learning promise** — "By the end of this book you will…"

Output file: `00-book-goal.md`

### Section 3 — Competitive Book Titles
Analyse up to three competitor titles. For each, describe the book, highlight key chapters,
summarise reviewer sentiment, and explain what makes your book different.

Output file: `00-competitive-titles.md`

### Section 4 — Learning Outcomes
List up to seven specific skills or capabilities the reader will gain. These become the
measurable objectives that guide the structure of your chapters.

Output file: `00-learning-outcomes.md`

### Section 5 — Parts & Chapters
Organise your book into **3–4 parts**, each containing **2–5 chapters**. The total number
of chapters must be between 8 and 17. This structure is used to auto-generate Section 6.

Output file: `00-book-structure.md`

### Section 6 — Detailed Chapter Outline
For every chapter you defined in Section 5, provide:

- Estimated page count
- Chapter description
- 3–6 sub-headings
- For each sub-heading, the skill the reader will learn

Output files: `01-chapter-slug.md`, `02-chapter-slug.md`, etc. (zero-padded, slugified titles)

### Section 7 — Community Outreach *(Optional)*
Add people who could help review, promote, or endorse your book:

- **Technical Reviewers** — subject-matter experts who will review the manuscript.
- **Amazon Reviewers** — readers who will write early reviews.
- **Influencers** — bloggers, podcasters, or social-media personalities.

Output file: `00-community-outreach.md`

---

## Saving Your Progress

Your answers are saved automatically in your **browser's localStorage** every time you
click **Next** or **Save & Continue Later**. No data is sent to any server — everything
stays on your device.

> **Important:** Clearing your browser data or switching browsers will erase your saved
> progress. Export your files regularly as a backup.

To manually save at any point, click the **Save & Continue Later** button. A confirmation
message will appear to confirm the save was successful.

To erase all saved data and start fresh, use the **Start Over** button on the final
review screen (you will be asked to confirm before anything is deleted).

---

## Exporting & Downloading Files

When you reach the final **Review & Export** screen:

1. Review a summary of every section.
2. Click **Download ZIP** to generate and download a ZIP archive.
3. Open the ZIP — it contains one Markdown file per section (plus one file per chapter).

### File Naming Convention

| File | Contents |
|------|----------|
| `00-about-the-author.md` | Author bio |
| `00-book-goal.md` | Book goal answers |
| `00-competitive-titles.md` | Competitive analysis |
| `00-learning-outcomes.md` | Learning outcomes |
| `00-book-structure.md` | Parts & chapters structure |
| `01-chapter-name.md` | First chapter detail |
| `02-chapter-name.md` | Second chapter detail |
| … | … |
| `00-community-outreach.md` | Community outreach contacts |

Chapter file names are **slugified** from the chapter title (lowercase, spaces replaced with
hyphens, special characters removed) and zero-padded to two digits.

---

## Tips for Writing a Good Book Outline

1. **Know your reader first.** Before filling in any other section, spend time on Section 2
   defining exactly who will read your book and what problem it solves for them.

2. **Be specific with learning outcomes.** Vague outcomes like "understand Python" are less
   useful than "write a REST API using FastAPI with full test coverage."

3. **Balance your chapters.** Aim for similar page counts across chapters within the same
   part. A chapter with 60 pages surrounded by 15-page chapters suggests a structural problem.

4. **Write chapter descriptions before sub-headings.** Draft the narrative description first,
   then extract the natural sub-headings from it.

5. **Competitive analysis is research.** Read (or at least skim) the books you're comparing
   against. Copy-pasting Amazon blurbs is not enough.

6. **Revisit the structure section last.** After completing the chapter outlines, return to
   Section 5 and verify that the part titles still make sense given the detailed content.

7. **Export early and often.** Save a ZIP after each session so you always have a recent
   backup outside your browser.
