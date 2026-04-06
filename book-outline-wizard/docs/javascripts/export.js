/**
 * export.js
 * Generates Markdown content from wizard data and packages everything into a
 * downloadable ZIP archive using JSZip (loaded from CDN).
 *
 * JSZip CDN: https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
 */

/* global window, document, JSZip */

(function () {
  'use strict';

  /* ------------------------------------------------------------------
   * Helpers
   * ------------------------------------------------------------------ */

  /** Convert a string to a URL/filename-safe slug */
  function slugify(text) {
    return (text || '')
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /** Zero-pad a number to at least 2 digits */
  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function safe(value) {
    return (value !== null && value !== undefined) ? String(value).trim() : '';
  }

  /* ------------------------------------------------------------------
   * Section Markdown generators
   * ------------------------------------------------------------------ */

  function generateAboutAuthor(data) {
    if (!data) { return ''; }
    var bio = safe(data.author_bio);
    return '# About the Author\n\n' + bio + '\n';
  }

  function generateBookGoal(data) {
    if (!data) { return ''; }
    var lines = ['# Book Goal\n'];
    lines.push('## Title\n\n' + safe(data.book_title) + '\n');
    if (data.book_subtitle) {
      lines.push('## Subtitle\n\n' + safe(data.book_subtitle) + '\n');
    }
    lines.push('## Target Audience\n\n' + safe(data.target_audience) + '\n');
    lines.push('## Prerequisites\n\n' + safe(data.prerequisites) + '\n');
    lines.push('## Unique Selling Point\n\n' + safe(data.usp) + '\n');
    lines.push('## Product Breakdown\n\n' + safe(data.product_breakdown) + '\n');
    lines.push('## Learning Promise\n\nBy the end of this book you will:\n\n' + safe(data.learning_promise) + '\n');
    return lines.join('\n');
  }

  function generateCompetitiveTitles(data) {
    if (!data || !data.competitors) { return ''; }
    var lines = ['# Competitive Book Titles\n'];
    data.competitors.forEach(function (comp, i) {
      lines.push('## Competitor ' + (i + 1) + ': ' + (safe(comp.comp_title) || '(untitled)') + '\n');
      lines.push('**Author:** ' + safe(comp.comp_author) + '\n');
      if (comp.comp_desc) {
        lines.push('### Description\n\n' + safe(comp.comp_desc) + '\n');
      }
      if (comp.comp_toc) {
        lines.push('### Table of Contents Highlights\n\n' + safe(comp.comp_toc) + '\n');
      }
      if (comp.comp_reviews) {
        lines.push('### Key Review Takeaways\n\n' + safe(comp.comp_reviews) + '\n');
      }
      if (comp.comp_difference) {
        lines.push('### What Makes Our Book Different\n\n' + safe(comp.comp_difference) + '\n');
      }
    });
    return lines.join('\n');
  }

  function generateLearningOutcomes(data) {
    if (!data || !data.outcomes) { return ''; }
    var lines = ['# Learning Outcomes\n'];
    data.outcomes.forEach(function (outcome, i) {
      if (safe(outcome)) {
        lines.push((i + 1) + '. ' + safe(outcome));
      }
    });
    lines.push('');
    return lines.join('\n');
  }

  function generateBookStructure(data) {
    if (!data || !data.parts) { return ''; }
    var lines = ['# Book Structure\n'];
    var chapterNum = 1;
    data.parts.forEach(function (part, pi) {
      lines.push('## Part ' + (pi + 1) + ': ' + (safe(part.title) || '(untitled)') + '\n');
      if (part.chapters) {
        part.chapters.forEach(function (ch) {
          lines.push('- Chapter ' + chapterNum + ': ' + (safe(ch) || '(untitled)'));
          chapterNum++;
        });
      }
      lines.push('');
    });
    return lines.join('\n');
  }

  /**
   * Generate a single chapter Markdown file.
   * @param {number} chapterNumber  1-based chapter number
   * @param {string} chapterTitle
   * @param {Object} data           chapter data from chapter-outlines section
   */
  function generateChapterFile(chapterNumber, chapterTitle, data) {
    data = data || {};
    var lines = [];
    lines.push('# Chapter ' + chapterNumber + ': ' + (safe(chapterTitle) || '(untitled)') + '\n');
    lines.push('**Estimated Pages:** ' + (safe(data.page_count) || 'TBD') + '\n');
    lines.push('## Description\n\n' + (safe(data.description) || '') + '\n');
    lines.push('## Chapter Sub-Headings\n');
    var headings = data.sub_headings || [];
    headings.forEach(function (sh) {
      if (sh && safe(sh.heading)) {
        lines.push('### ' + safe(sh.heading));
        lines.push('**Skill learned:** ' + (safe(sh.skill) || '') + '\n');
      }
    });

    var images = data.images || [];
    if (images.length > 0) {
      lines.push('## Chapter Images\n');
      images.forEach(function (img) {
        var safeName = safe(img.name) || 'image';
        var safePath = safe(img.path) || ('images/' + safeName);
        lines.push('- ![' + safeName + '](' + safePath + ')');
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  function generateCommunityOutreach(data) {
    if (!data) { return ''; }
    var lines = ['# Community Outreach\n'];

    function renderTable(title, rows) {
      lines.push('## ' + title + '\n');
      if (!rows || rows.length === 0) {
        lines.push('_No entries._\n');
        return;
      }
      lines.push('| Full Name | Email | LinkedIn URL |');
      lines.push('|-----------|-------|-------------|');
      rows.forEach(function (row) {
        lines.push('| ' + safe(row.full_name) + ' | ' + safe(row.email) + ' | ' + safe(row.linkedin_url) + ' |');
      });
      lines.push('');
    }

    var reviewers = data.reviewers || {};
    renderTable('Technical Reviewers', reviewers.technical_reviewers);
    renderTable('Amazon Reviewers',    reviewers.amazon_reviewers);
    renderTable('Influencers',         reviewers.influencers);
    return lines.join('\n');
  }

  function generateProjectReadme(bookName, allData) {
    var goal = allData['book-goal'] || {};
    var title = safe(goal.book_title) || safe(bookName) || 'Untitled Book';
    var subtitle = safe(goal.book_subtitle);

    var lines = [];
    lines.push('# ' + title);
    lines.push('');
    if (subtitle) {
      lines.push('> ' + subtitle);
      lines.push('');
    }
    lines.push('This repository was generated by the Book Outline Wizard.');
    lines.push('');
    lines.push('## Structure');
    lines.push('');
    lines.push('- `outline/sections/` contains planning and outline markdown files.');
    lines.push('- `manuscript/` contains draft chapter files grouped by part.');
    lines.push('');
    return lines.join('\n');
  }

  /* ------------------------------------------------------------------
   * generateMarkdown — dispatch by section id
   * ------------------------------------------------------------------ */

  function generateMarkdown(sectionId, data) {
    switch (sectionId) {
      case 'about-the-author':    return generateAboutAuthor(data);
      case 'book-goal':           return generateBookGoal(data);
      case 'competitive-titles':  return generateCompetitiveTitles(data);
      case 'learning-outcomes':   return generateLearningOutcomes(data);
      case 'book-structure':      return generateBookStructure(data);
      case 'community-outreach':  return generateCommunityOutreach(data);
      default:                    return '';
    }
  }

  /* ------------------------------------------------------------------
   * ZIP download
   * ------------------------------------------------------------------ */

  /**
   * Load JSZip from CDN if not already available, then invoke callback.
   */
  function ensureJSZip(callback) {
    if (typeof JSZip !== 'undefined') {
      callback(null, JSZip);
      return;
    }
    var script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.onload = function () { callback(null, JSZip); };
    script.onerror = function () { callback(new Error('Failed to load JSZip from CDN')); };
    document.head.appendChild(script);
  }

  /**
   * Build and download a ZIP of all completed sections.
   */
  function downloadAllAsZip() {
    ensureJSZip(function (err) {
      if (err) {
        alert('Could not load ZIP library. Please check your internet connection and try again.');
        return;
      }

      var allData = window.WizardStorage ? window.WizardStorage.loadAllProgress() : {};
      var zip = new JSZip();

      // Static sections
      var staticSections = [
        { id: 'about-the-author',   filename: 'sections/01-about-the-author.md' },
        { id: 'book-goal',          filename: 'sections/02-book-goal.md' },
        { id: 'competitive-titles', filename: 'sections/03-competitive-titles.md' },
        { id: 'learning-outcomes',  filename: 'sections/04-learning-outcomes.md' },
        { id: 'book-structure',     filename: 'sections/05-book-structure.md' }
      ];

      var outlineIndex = [
        '# Book Outline Export',
        '',
        '## Sections',
        '',
        '- [About the Author](sections/01-about-the-author.md)',
        '- [Book Goal](sections/02-book-goal.md)',
        '- [Competitive Titles](sections/03-competitive-titles.md)',
        '- [Learning Outcomes](sections/04-learning-outcomes.md)',
        '- [Book Structure](sections/05-book-structure.md)'
      ];

      staticSections.forEach(function (s) {
        var content = generateMarkdown(s.id, allData[s.id]);
        if (content) { zip.file(s.filename, content); }
      });

      // Chapter files — derived from book-structure + chapter-outlines
      var structureData  = allData['book-structure'];
      var outlinesData   = allData['chapter-outlines'] || {};
      if (structureData && structureData.parts) {
        var chapterNum = 1;
        structureData.parts.forEach(function (part) {
          if (part.chapters) {
            part.chapters.forEach(function (chTitle) {
              var key      = 'chapter_' + chapterNum;
              var chData   = outlinesData[key] || {};
              var slug     = slugify(chTitle);
              var filename = 'chapters/' + pad2(chapterNum) + '-' + slug + '.md';
              zip.file(filename, generateChapterFile(chapterNum, chTitle, chData));
              outlineIndex.push('- [Chapter ' + chapterNum + ': ' + (safe(chTitle) || '(untitled)') + '](' + filename + ')');
              chapterNum++;
            });
          }
        });
      }

      // Community outreach
      var outreachContent = generateMarkdown('community-outreach', allData['community-outreach']);
      if (outreachContent) {
        zip.file('sections/06-community-outreach.md', outreachContent);
        outlineIndex.push('- [Community Outreach](sections/06-community-outreach.md)');
      }

      outlineIndex.push('');
      zip.file('README.md', outlineIndex.join('\n'));

      // Generate and trigger download
      zip.generateAsync({ type: 'blob' }).then(function (blob) {
        var url = window.URL.createObjectURL(blob);
        var a   = document.createElement('a');
        a.href     = url;
        a.download = 'book-outline.zip';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);
      }).catch(function (zipErr) {
        alert('Error generating ZIP: ' + zipErr.message);
      });
    });
  }

  function buildRepoFileMap(allData, bookName) {
    allData = allData || {};
    var fileMap = {};

    var staticSections = [
      { id: 'about-the-author',   filename: 'outline/sections/01-about-the-author.md' },
      { id: 'book-goal',          filename: 'outline/sections/02-book-goal.md' },
      { id: 'competitive-titles', filename: 'outline/sections/03-competitive-titles.md' },
      { id: 'learning-outcomes',  filename: 'outline/sections/04-learning-outcomes.md' },
      { id: 'book-structure',     filename: 'outline/sections/05-book-structure.md' }
    ];

    staticSections.forEach(function (s) {
      var content = generateMarkdown(s.id, allData[s.id]);
      if (content) {
        fileMap[s.filename] = content;
      }
    });

    var structureData = allData['book-structure'];
    var outlinesData = allData['chapter-outlines'] || {};
    if (structureData && structureData.parts) {
      var chapterNum = 1;
      structureData.parts.forEach(function (part, partIndex) {
        var partSlug = slugify(part.title || ('part-' + (partIndex + 1)));
        var partDir = 'manuscript/part-' + pad2(partIndex + 1) + '-' + partSlug;

        (part.chapters || []).forEach(function (chTitle) {
          var key = 'chapter_' + chapterNum;
          var chData = outlinesData[key] || {};
          var chSlug = slugify(chTitle || ('chapter-' + chapterNum));
          var chapterBaseName = 'chapter-' + pad2(chapterNum) + '-' + chSlug;
          var filename = partDir + '/' + chapterBaseName + '.md';

          var images = Array.isArray(chData.images) ? chData.images : [];
          images.forEach(function (img, imageIndex) {
            if (!img || !img.contentBase64) { return; }
            var ext = (safe(img.name).split('.').pop() || 'png').toLowerCase();
            var imageName = 'img-' + pad2(imageIndex + 1) + '.' + ext;
            var imagePath = partDir + '/images/' + chapterBaseName + '/' + imageName;
            img.path = './images/' + chapterBaseName + '/' + imageName;
            fileMap[imagePath] = {
              content: img.contentBase64,
              rawBase64: true
            };
          });

          fileMap[filename] = generateChapterFile(chapterNum, chTitle, chData);
          chapterNum++;
        });
      });
    }

    var outreachContent = generateMarkdown('community-outreach', allData['community-outreach']);
    if (outreachContent) {
      fileMap['outline/sections/06-community-outreach.md'] = outreachContent;
    }

    fileMap['README.md'] = generateProjectReadme(bookName, allData);
    return fileMap;
  }

  // Expose on window
  window.WizardExport = {
    generateMarkdown: generateMarkdown,
    generateChapterFile: generateChapterFile,
    downloadAllAsZip: downloadAllAsZip,
    slugify: slugify,
    buildRepoFileMap: buildRepoFileMap
  };
}());
