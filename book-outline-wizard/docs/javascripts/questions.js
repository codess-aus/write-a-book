/**
 * questions.js
 * Defines all wizard sections and their fields as a structured data object.
 */

/* global window */

(function () {
  'use strict';

  /**
   * Each section has:
   *   id          {string}  - unique identifier
   *   title       {string}  - display title
   *   description {string}  - instructions shown to the author
   *   optional    {boolean} - whether the section may be skipped
   *   fields      {Array}   - field definitions (see below)
   *
   * Field types:
   *   text          - single-line text input
   *   textarea      - multi-line text area
   *   number        - numeric input
   *   char-counter  - textarea with a live character counter
   *   dynamic-list  - a list of text inputs the user can grow/shrink
   *   dynamic-group - a repeating group of sub-fields (e.g. competitive titles)
   *   parts-chapters - the special Parts & Chapters builder
   *   chapter-outlines - auto-generated chapter detail forms
   *   reviewer-tables  - the three community-outreach tables
   */
  var WIZARD_SECTIONS = [
    {
      id: 'about-the-author',
      title: 'Section 1: About the Author',
      description: 'Write a short professional biography that will introduce you to your readers. Keep it concise and focused on your relevant expertise.',
      optional: false,
      fields: [
        {
          id: 'author_bio',
          label: 'Author Bio',
          type: 'char-counter',
          maxChars: 750,
          placeholder: 'Mark J. Price is a Microsoft Specialist: Programming in C# and has worked at Capgemini since 2002 as a consultant and developer. For the past seven years, Mark has been working for Optimum Healthcare IT, specializing in the adoption and training of Microsoft platforms for digital transformation projects...',
          helpText: 'Maximum 750 characters including spaces.',
          validation: { required: true, maxLength: 750 }
        }
      ]
    },
    {
      id: 'book-goal',
      title: 'Section 2: The Book\'s Goal',
      description: 'Define the core purpose and positioning of your book. These details help your editor and publisher understand the unique value of your work.',
      optional: false,
      fields: [
        {
          id: 'book_title',
          label: 'Book Title',
          type: 'text',
          placeholder: 'e.g. Mastering Cloud-Native Development',
          validation: { required: true }
        },
        {
          id: 'book_subtitle',
          label: 'Book Subtitle',
          type: 'text',
          placeholder: 'e.g. Build scalable, resilient applications with .NET and Azure',
          validation: { required: false }
        },
        {
          id: 'target_audience',
          label: 'What kind of individual would be interested in this book?',
          type: 'textarea',
          placeholder: 'Describe your ideal reader — their role, experience level, goals, and challenges.',
          validation: { required: true }
        },
        {
          id: 'prerequisites',
          label: 'What knowledge do they need before they start reading?',
          type: 'textarea',
          placeholder: 'List prerequisite skills, tools, or concepts the reader should already know.',
          validation: { required: true }
        },
        {
          id: 'usp',
          label: 'Why should they buy this book? What is the product approach and USP?',
          type: 'textarea',
          placeholder: 'Explain the unique selling point — what makes this book different and why a reader should choose it.',
          validation: { required: true }
        },
        {
          id: 'product_breakdown',
          label: 'Product Breakdown: In 6–7 sentences, describe the journey the book takes the reader on.',
          type: 'textarea',
          placeholder: 'Summarise the narrative arc of the book from start to finish.',
          validation: { required: true }
        },
        {
          id: 'learning_promise',
          label: 'By the end of this book you will…',
          type: 'textarea',
          placeholder: 'Complete this sentence with the key capabilities the reader will have gained.',
          validation: { required: true }
        }
      ]
    },
    {
      id: 'competitive-titles',
      title: 'Section 3: Competitive Book Titles',
      description: 'Analyse up to three competing books. Understanding the competition helps you sharpen your own book\'s positioning.',
      optional: false,
      fields: [
        {
          id: 'competitors',
          type: 'dynamic-group',
          groupLabel: 'Competitor',
          minGroups: 1,
          maxGroups: 3,
          defaultGroups: 3,
          subFields: [
            { id: 'comp_title',      label: 'Book Title',                               type: 'text',     validation: { required: false } },
            { id: 'comp_author',     label: 'Author',                                   type: 'text',     validation: { required: false } },
            { id: 'comp_desc',       label: 'Description Summary',                      type: 'textarea', validation: { required: false } },
            { id: 'comp_toc',        label: 'Table of Contents Highlights',             type: 'textarea', validation: { required: false } },
            { id: 'comp_reviews',    label: 'Key Review Takeaways',                     type: 'textarea', validation: { required: false } },
            { id: 'comp_difference', label: 'What makes YOUR book different from this one?', type: 'textarea', validation: { required: false } }
          ]
        }
      ]
    },
    {
      id: 'learning-outcomes',
      title: 'Section 4: Learning Outcomes',
      description: 'List up to seven specific, measurable things the reader will learn and be able to do after finishing your book.',
      optional: false,
      fields: [
        {
          id: 'outcomes',
          type: 'dynamic-list',
          label: 'What will the reader learn and be able to do?',
          itemLabel: 'Learning Outcome',
          minItems: 1,
          maxItems: 7,
          defaultItems: 7,
          placeholder: 'e.g. Build and deploy a microservices application using Docker and Kubernetes',
          validation: { required: true, minItems: 1 }
        }
      ]
    },
    {
      id: 'book-structure',
      title: 'Section 5: Parts & Chapters',
      description: 'Organise your book into parts and chapters. There is no hard upper limit on parts or chapters.',
      optional: false,
      fields: [
        {
          id: 'parts',
          type: 'parts-chapters',
          minParts: 1,
          minChaptersPerPart: 1,
          minTotalChapters: 1
        }
      ]
    },
    {
      id: 'chapter-outlines',
      title: 'Section 6: Detailed Chapter Outline',
      description: 'Provide detailed information for each chapter you defined in the previous section. This section is auto-generated from your Parts & Chapters.',
      optional: false,
      fields: [
        {
          id: 'chapters',
          type: 'chapter-outlines',
          minSubHeadings: 3,
          maxSubHeadings: 6
        }
      ]
    },
    {
      id: 'community-outreach',
      title: 'Section 7: Community Outreach',
      description: 'Add people who could help review, promote, or endorse your book. This section is optional — skip it if not applicable.',
      optional: true,
      fields: [
        {
          id: 'reviewers',
          type: 'reviewer-tables',
          tables: [
            { id: 'technical_reviewers', label: 'Technical Reviewers' },
            { id: 'amazon_reviewers',    label: 'Amazon Reviewers' },
            { id: 'influencers',         label: 'Influencers' }
          ],
          columns: [
            { id: 'full_name',     label: 'Full Name',     type: 'text' },
            { id: 'email',         label: 'Email',         type: 'text' },
            { id: 'linkedin_url',  label: 'LinkedIn URL',  type: 'text' }
          ]
        }
      ]
    }
  ];

  window.WIZARD_SECTIONS = WIZARD_SECTIONS;
}());
