/**
 * wizard.js
 * Core wizard: step navigation, rendering, validation, and review/export UI.
 *
 * Depends on: questions.js, storage.js, export.js, github.js
 */

/* global window, document, WizardStorage, WizardExport, WizardGitHub, WIZARD_SECTIONS */

(function () {
  'use strict';

  /* ------------------------------------------------------------------
   * State
   * ------------------------------------------------------------------ */
  var currentStep = 0;   // index into WIZARD_SECTIONS
  var totalSteps  = 0;
  var githubSession = null;
  var activeProject = null;
  var pendingImageReads = 0;

  /* ------------------------------------------------------------------
   * Utility helpers
   * ------------------------------------------------------------------ */

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'className') {
          node.className = attrs[k];
        } else if (k === 'innerHTML') {
          node.innerHTML = attrs[k];
        } else {
          node.setAttribute(k, attrs[k]);
        }
      });
    }
    if (children) {
      children.forEach(function (c) {
        if (typeof c === 'string') {
          node.appendChild(document.createTextNode(c));
        } else if (c) {
          node.appendChild(c);
        }
      });
    }
    return node;
  }

  function labelEl(text, forId, optionalFlag) {
    var lbl = el('label', { 'for': forId });
    lbl.textContent = text;
    if (optionalFlag) {
      var span = el('span', { className: 'field-optional' });
      span.textContent = ' (optional)';
      lbl.appendChild(span);
    }
    return lbl;
  }

  function sanitizeFileName(name) {
    return (name || 'image')
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-');
  }

  /* ------------------------------------------------------------------
   * Collect data from the current rendered form
   * ------------------------------------------------------------------ */

  function collectSectionData(section) {
    var data = {};
    section.fields.forEach(function (field) {
      switch (field.type) {
        case 'text':
        case 'textarea':
        case 'number':
        case 'char-counter': {
          var inp = document.getElementById(field.id);
          data[field.id] = inp ? inp.value : '';
          break;
        }
        case 'dynamic-list': {
          var items = document.querySelectorAll('.dynamic-list-item[data-field="' + field.id + '"] input, .dynamic-list-item[data-field="' + field.id + '"] textarea');
          data[field.id] = Array.prototype.map.call(items, function (i) { return i.value; });
          break;
        }
        case 'dynamic-group': {
          var groups = document.querySelectorAll('.dynamic-group[data-field="' + field.id + '"]');
          data[field.id] = Array.prototype.map.call(groups, function (g) {
            var obj = {};
            field.subFields.forEach(function (sf) {
              var sfInp = g.querySelector('[data-subfield="' + sf.id + '"]');
              obj[sf.id] = sfInp ? sfInp.value : '';
            });
            return obj;
          });
          break;
        }
        case 'parts-chapters': {
          data['parts'] = collectParts();
          break;
        }
        case 'chapter-outlines': {
          data = collectChapterOutlines();
          break;
        }
        case 'reviewer-tables': {
          data['reviewers'] = collectReviewerTables(field);
          break;
        }
      }
    });
    return data;
  }

  function collectParts() {
    var partEls = document.querySelectorAll('.part-block');
    return Array.prototype.map.call(partEls, function (partEl) {
      var titleInp = partEl.querySelector('.part-title-input');
      var chapterInps = partEl.querySelectorAll('.chapter-input');
      return {
        title: titleInp ? titleInp.value : '',
        chapters: Array.prototype.map.call(chapterInps, function (ci) { return ci.value; })
      };
    });
  }

  function collectChapterOutlines() {
    var data = {};
    var chapterBlocks = document.querySelectorAll('.chapter-outline-block');
    chapterBlocks.forEach(function (block) {
      var key       = block.getAttribute('data-chapter-key');
      var pageInp   = block.querySelector('.chapter-page-count');
      var descInp   = block.querySelector('.chapter-description');
      var shRows    = block.querySelectorAll('.subheading-row');
      var imageStoreInp = block.querySelector('.chapter-images-store');
      var images = [];
      if (imageStoreInp && imageStoreInp.value) {
        try {
          images = JSON.parse(imageStoreInp.value);
        } catch (e) {
          images = [];
        }
      }
      var subHeadings = Array.prototype.map.call(shRows, function (row) {
        var heading = row.querySelector('.sh-heading');
        var skill   = row.querySelector('.sh-skill');
        return {
          heading: heading ? heading.value : '',
          skill:   skill   ? skill.value   : ''
        };
      });
      data[key] = {
        page_count:   pageInp  ? pageInp.value  : '',
        description:  descInp  ? descInp.value  : '',
        sub_headings: subHeadings,
        images: images
      };
    });
    return data;
  }

  function collectReviewerTables(field) {
    var result = {};
    field.tables.forEach(function (table) {
      var rows = document.querySelectorAll('.reviewer-row[data-table="' + table.id + '"]');
      result[table.id] = Array.prototype.map.call(rows, function (row) {
        var obj = {};
        field.columns.forEach(function (col) {
          var inp = row.querySelector('[data-col="' + col.id + '"]');
          obj[col.id] = inp ? inp.value : '';
        });
        return obj;
      });
    });
    return result;
  }

  /* ------------------------------------------------------------------
   * Validation
   * ------------------------------------------------------------------ */

  function validateSection(section, data) {
    var errors = [];
    if (section.optional) { return errors; }

    section.fields.forEach(function (field) {
      switch (field.type) {
        case 'text':
        case 'textarea':
        case 'number':
        case 'char-counter': {
          var val = (data[field.id] || '').trim();
          if (field.validation && field.validation.required && !val) {
            errors.push({ fieldId: field.id, message: field.label + ' is required.' });
          }
          if (field.maxChars && val.length > field.maxChars) {
            errors.push({ fieldId: field.id, message: field.label + ' must be ' + field.maxChars + ' characters or fewer.' });
          }
          break;
        }
        case 'dynamic-list': {
          var outcomes = data[field.id] || [];
          var nonEmpty = outcomes.filter(function (v) { return v && v.trim(); });
          if (field.validation && field.validation.minItems && nonEmpty.length < field.validation.minItems) {
            errors.push({ fieldId: field.id, message: 'Please enter at least ' + field.validation.minItems + ' learning outcome(s).' });
          }
          break;
        }
        case 'parts-chapters': {
          errors = errors.concat(validateParts(data['parts'] || [], field));
          break;
        }
      }
    });
    return errors;
  }

  function validateParts(parts, field) {
    var errors = [];
    if (parts.length < field.minParts) {
      errors.push({ fieldId: 'parts', message: 'You need at least ' + field.minParts + ' parts.' });
    }
    var totalChapters = 0;
    parts.forEach(function (part, i) {
      var chs = (part.chapters || []).filter(function (c) { return c && c.trim(); });
      if (chs.length < field.minChaptersPerPart) {
        errors.push({ fieldId: 'parts', message: 'Part ' + (i + 1) + ' needs at least ' + field.minChaptersPerPart + ' chapters.' });
      }
      totalChapters += chs.length;
    });
    if (totalChapters < field.minTotalChapters) {
      errors.push({ fieldId: 'parts', message: 'You need at least ' + field.minTotalChapters + ' chapters in total.' });
    }
    return errors;
  }

  /* ------------------------------------------------------------------
   * Rendering helpers for field types
   * ------------------------------------------------------------------ */

  function renderTextField(field, savedValue) {
    var wrap = el('div', { className: 'field-group' });
    wrap.appendChild(labelEl(field.label, field.id, field.validation && !field.validation.required));
    if (field.helpText) {
      var help = el('p', { className: 'field-help', id: field.id + '-help' });
      help.textContent = field.helpText;
      wrap.appendChild(help);
    }
    var input = el('input', {
      type: 'text',
      id: field.id,
      name: field.id,
      placeholder: field.placeholder || '',
      value: savedValue || '',
      'aria-describedby': field.helpText ? field.id + '-help' : null
    });
    if (field.validation && field.validation.required) {
      input.setAttribute('required', 'required');
      input.setAttribute('aria-required', 'true');
    }
    wrap.appendChild(input);
    var errEl = el('p', { className: 'field-error', id: field.id + '-error', role: 'alert', 'aria-live': 'polite' });
    wrap.appendChild(errEl);
    return wrap;
  }

  function renderTextareaField(field, savedValue) {
    var wrap = el('div', { className: 'field-group' });
    wrap.appendChild(labelEl(field.label, field.id, field.validation && !field.validation.required));
    if (field.helpText) {
      var help = el('p', { className: 'field-help', id: field.id + '-help' });
      help.textContent = field.helpText;
      wrap.appendChild(help);
    }
    var textarea = el('textarea', {
      id: field.id,
      name: field.id,
      placeholder: field.placeholder || '',
      rows: '5',
      'aria-describedby': field.helpText ? field.id + '-help' : null
    });
    textarea.value = savedValue || '';
    if (field.validation && field.validation.required) {
      textarea.setAttribute('required', 'required');
      textarea.setAttribute('aria-required', 'true');
    }
    wrap.appendChild(textarea);
    var errEl = el('p', { className: 'field-error', id: field.id + '-error', role: 'alert', 'aria-live': 'polite' });
    wrap.appendChild(errEl);
    return wrap;
  }

  function renderCharCounterField(field, savedValue) {
    var wrap = el('div', { className: 'field-group' });
    wrap.appendChild(labelEl(field.label, field.id));
    if (field.helpText) {
      var help = el('p', { className: 'field-help', id: field.id + '-help' });
      help.textContent = field.helpText;
      wrap.appendChild(help);
    }
    var textarea = el('textarea', {
      id: field.id,
      name: field.id,
      placeholder: field.placeholder || '',
      rows: '8',
      maxlength: String(field.maxChars),
      'aria-describedby': field.id + '-counter' + (field.helpText ? ' ' + field.id + '-help' : '')
    });
    textarea.value = savedValue || '';
    wrap.appendChild(textarea);
    var counter = el('p', { className: 'char-counter', id: field.id + '-counter', 'aria-live': 'polite' });
    var currentLen = (savedValue || '').length;
    counter.textContent = currentLen + ' / ' + field.maxChars + ' characters';
    if (currentLen > field.maxChars * 0.9) { counter.classList.add('char-counter--warn'); }
    textarea.addEventListener('input', function () {
      var len = textarea.value.length;
      counter.textContent = len + ' / ' + field.maxChars + ' characters';
      counter.classList.toggle('char-counter--warn', len > field.maxChars * 0.9);
    });
    var errEl = el('p', { className: 'field-error', id: field.id + '-error', role: 'alert', 'aria-live': 'polite' });
    wrap.appendChild(errEl);
    return wrap;
  }

  function renderDynamicList(field, savedValue) {
    var wrap = el('div', { className: 'field-group' });
    var titleEl = el('p', { className: 'field-label' });
    titleEl.textContent = field.label;
    wrap.appendChild(titleEl);

    var listWrap = el('div', { id: field.id + '-list', className: 'dynamic-list-wrap' });

    var savedItems = savedValue || [];
    var count = Math.max(savedItems.length, field.defaultItems || 1);
    count = Math.min(count, field.maxItems);

    function addItem(value, index) {
      var itemWrap = el('div', { className: 'dynamic-list-item', 'data-field': field.id });
      var lbl = el('label', { 'for': field.id + '_' + index });
      lbl.textContent = (field.itemLabel || 'Item') + ' ' + (index + 1);
      var inp = el('input', {
        type: 'text',
        id: field.id + '_' + index,
        placeholder: field.placeholder || '',
        value: value || ''
      });
      var removeBtn = el('button', { type: 'button', className: 'btn-icon btn-remove-item', 'aria-label': 'Remove item ' + (index + 1) });
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', function () {
        itemWrap.parentNode.removeChild(itemWrap);
        renumberItems(listWrap, field.id, field.itemLabel || 'Item');
      });
      itemWrap.appendChild(lbl);
      itemWrap.appendChild(inp);
      itemWrap.appendChild(removeBtn);
      listWrap.appendChild(itemWrap);
    }

    for (var i = 0; i < count; i++) {
      addItem(savedItems[i], i);
    }

    wrap.appendChild(listWrap);

    var addBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-sm' });
    addBtn.textContent = '+ Add Outcome';
    addBtn.addEventListener('click', function () {
      var items = listWrap.querySelectorAll('.dynamic-list-item');
      if (items.length < field.maxItems) {
        addItem('', items.length);
      }
    });
    wrap.appendChild(addBtn);

    var errEl = el('p', { className: 'field-error', id: field.id + '-error', role: 'alert', 'aria-live': 'polite' });
    wrap.appendChild(errEl);
    return wrap;
  }

  function renumberItems(listWrap, fieldId, itemLabel) {
    var items = listWrap.querySelectorAll('.dynamic-list-item');
    items.forEach(function (item, i) {
      var lbl = item.querySelector('label');
      var inp = item.querySelector('input');
      if (lbl) { lbl.textContent = itemLabel + ' ' + (i + 1); }
      if (inp) {
        inp.id = fieldId + '_' + i;
        if (lbl) { lbl.setAttribute('for', inp.id); }
      }
    });
  }

  function renderDynamicGroup(field, savedValue) {
    var wrap = el('div', { className: 'field-group' });
    var groups = savedValue || [];
    var count = groups.length || field.defaultGroups || field.minGroups || 1;
    count = Math.min(count, field.maxGroups || 99);

    function renderGroup(idx, groupData) {
      var groupEl = el('div', { className: 'dynamic-group wizard-card', 'data-field': field.id, 'data-index': String(idx) });
      var titleEl = el('h3', {});
      titleEl.textContent = field.groupLabel + ' ' + (idx + 1);
      groupEl.appendChild(titleEl);

      field.subFields.forEach(function (sf) {
        var sfWrap = el('div', { className: 'field-group' });
        var sfId   = field.id + '_' + idx + '_' + sf.id;
        sfWrap.appendChild(labelEl(sf.label, sfId, !sf.validation || !sf.validation.required));
        var sfInp;
        if (sf.type === 'textarea') {
          sfInp = el('textarea', { id: sfId, name: sfId, 'data-subfield': sf.id, rows: '4' });
        } else {
          sfInp = el('input', { type: 'text', id: sfId, name: sfId, 'data-subfield': sf.id });
        }
        sfInp.value = groupData ? (groupData[sf.id] || '') : '';
        sfWrap.appendChild(sfInp);
        groupEl.appendChild(sfWrap);
      });

      return groupEl;
    }

    var groupsWrap = el('div', { id: field.id + '-groups' });
    for (var i = 0; i < count; i++) {
      groupsWrap.appendChild(renderGroup(i, groups[i]));
    }
    wrap.appendChild(groupsWrap);
    return wrap;
  }

  function renderPartsChapters(field, savedData) {
    var wrap = el('div', { className: 'field-group' });
    var savedParts = (savedData && savedData.parts) ? savedData.parts : null;

    var defaultPartCount = savedParts ? savedParts.length : field.minParts;
    var partsWrap = el('div', { id: 'parts-wrap' });

    function renderPart(partIdx, partData) {
      var partEl = el('div', { className: 'part-block wizard-card' });
      var partHeader = el('div', { className: 'part-header' });
      var partTitle = el('h3', {});
      partTitle.textContent = 'Part ' + (partIdx + 1);
      var removePartBtn = el('button', { type: 'button', className: 'btn-icon btn-remove-part', 'aria-label': 'Remove Part ' + (partIdx + 1) });
      removePartBtn.textContent = '✕';
      removePartBtn.addEventListener('click', function () {
        var allParts = partsWrap.querySelectorAll('.part-block');
          partEl.parentNode.removeChild(partEl);
      });
      partHeader.appendChild(partTitle);
      partHeader.appendChild(removePartBtn);
      partEl.appendChild(partHeader);

      var partTitleWrap = el('div', { className: 'field-group' });
      var ptLblId = 'part_title_' + partIdx;
      partTitleWrap.appendChild(labelEl('Part Title', ptLblId));
      var ptInp = el('input', { type: 'text', id: ptLblId, className: 'part-title-input', placeholder: 'e.g. Getting Started' });
      ptInp.value = (partData && partData.title) ? partData.title : '';
      partTitleWrap.appendChild(ptInp);
      partEl.appendChild(partTitleWrap);

      var chaptersWrap = el('div', { className: 'chapters-wrap' });
      var chaptersTitle = el('h4', {});
      chaptersTitle.textContent = 'Chapters';
      chaptersWrap.appendChild(chaptersTitle);

      var chapterListEl = el('div', { className: 'chapter-list' });
      var savedChapters = (partData && partData.chapters) ? partData.chapters : ['', ''];

      function renderChapterRow(chIdx, value) {
        var rowEl = el('div', { className: 'chapter-row' });
        var chLblId = 'part_' + partIdx + '_ch_' + chIdx;
        rowEl.appendChild(labelEl('Chapter ' + (chIdx + 1), chLblId));
        var chInp = el('input', { type: 'text', id: chLblId, className: 'chapter-input', placeholder: 'e.g. Introduction to Cloud Computing' });
        chInp.value = value || '';
        var removeChBtn = el('button', { type: 'button', className: 'btn-icon btn-remove-ch', 'aria-label': 'Remove chapter ' + (chIdx + 1) });
        removeChBtn.textContent = '✕';
        removeChBtn.addEventListener('click', function () {
          var allChs = chapterListEl.querySelectorAll('.chapter-row');
          if (allChs.length > field.minChaptersPerPart) {
            rowEl.parentNode.removeChild(rowEl);
            renumberChapters(chapterListEl);
          } else {
            showInlineMsg(partEl, 'Each part needs at least ' + field.minChaptersPerPart + ' chapters.');
          }
        });
        rowEl.appendChild(chInp);
        rowEl.appendChild(removeChBtn);
        return rowEl;
      }

      savedChapters.forEach(function (ch, ci) {
        chapterListEl.appendChild(renderChapterRow(ci, ch));
      });

      chaptersWrap.appendChild(chapterListEl);

      var addChBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-sm' });
      addChBtn.textContent = '+ Add Chapter';
      addChBtn.addEventListener('click', function () {
        var allChs = chapterListEl.querySelectorAll('.chapter-row');
        chapterListEl.appendChild(renderChapterRow(allChs.length, ''));
      });
      chaptersWrap.appendChild(addChBtn);
      partEl.appendChild(chaptersWrap);
      return partEl;
    }

    function renumberParts() {
      var parts = partsWrap.querySelectorAll('.part-block');
      parts.forEach(function (p, i) {
        var h = p.querySelector('.part-header h3');
        if (h) { h.textContent = 'Part ' + (i + 1); }
        var btn = p.querySelector('.btn-remove-part');
        if (btn) { btn.setAttribute('aria-label', 'Remove Part ' + (i + 1)); }
      });
    }

    function renumberChapters(listEl) {
      var rows = listEl.querySelectorAll('.chapter-row');
      rows.forEach(function (row, i) {
        var lbl = row.querySelector('label');
        if (lbl) { lbl.textContent = 'Chapter ' + (i + 1); }
        var btn = row.querySelector('.btn-remove-ch');
        if (btn) { btn.setAttribute('aria-label', 'Remove chapter ' + (i + 1)); }
      });
    }

    var savedPartCount = savedParts ? savedParts.length : defaultPartCount;
    for (var i = 0; i < savedPartCount; i++) {
      partsWrap.appendChild(renderPart(i, savedParts ? savedParts[i] : null));
    }

    wrap.appendChild(partsWrap);

    var addPartBtn = el('button', { type: 'button', className: 'btn btn-secondary' });
    addPartBtn.textContent = '+ Add Part';
    addPartBtn.addEventListener('click', function () {
      var allParts = partsWrap.querySelectorAll('.part-block');
      partsWrap.appendChild(renderPart(allParts.length, null));
    });
    wrap.appendChild(addPartBtn);

    var errEl = el('p', { className: 'field-error', id: 'parts-error', role: 'alert', 'aria-live': 'polite' });
    wrap.appendChild(errEl);
    return wrap;
  }

  function renderChapterOutlines(field, savedData) {
    var wrap = el('div', { className: 'field-group' });

    // Pull chapters from book-structure saved data
    var structureData = WizardStorage.loadProgress('book-structure');
    var chapters = [];
    if (structureData && structureData.parts) {
      structureData.parts.forEach(function (part) {
        if (part.chapters) {
          part.chapters.forEach(function (ch) {
            chapters.push(ch);
          });
        }
      });
    }

    if (chapters.length === 0) {
      var note = el('p', { className: 'info-note' });
      note.textContent = 'No chapters found. Please complete Section 5 (Parts & Chapters) first.';
      wrap.appendChild(note);
      return wrap;
    }

    chapters.forEach(function (chTitle, idx) {
      var chNum    = idx + 1;
      var key      = 'chapter_' + chNum;
      var savedCh  = (savedData && savedData[key]) ? savedData[key] : {};

      var block = el('div', { className: 'chapter-outline-block wizard-card', 'data-chapter-key': key });
      var hdr = el('h3', {});
      hdr.textContent = 'Chapter ' + chNum + ': ' + (chTitle || '(untitled)');
      block.appendChild(hdr);

      // Page count
      var pageWrap = el('div', { className: 'field-group' });
      var pageLblId = key + '_pages';
      pageWrap.appendChild(labelEl('Estimated Page Count', pageLblId));
      var pageInp = el('input', {
        type: 'number', id: pageLblId, className: 'chapter-page-count',
        min: '1', max: '999', placeholder: '20'
      });
      pageInp.value = savedCh.page_count || '';
      pageWrap.appendChild(pageInp);
      block.appendChild(pageWrap);

      // Description
      var descWrap = el('div', { className: 'field-group' });
      var descLblId = key + '_desc';
      descWrap.appendChild(labelEl('Chapter Description', descLblId));
      var descArea = el('textarea', { id: descLblId, className: 'chapter-description', rows: '5', placeholder: 'Describe what this chapter covers...' });
      descArea.value = savedCh.description || '';
      descWrap.appendChild(descArea);
      block.appendChild(descWrap);

      // Sub-headings
      var shSection = el('div', { className: 'subheadings-section' });
      var shTitle = el('h4', {});
      shTitle.textContent = 'Sub-Headings (3–6)';
      shSection.appendChild(shTitle);

      var shList = el('div', { className: 'subheadings-list' });
      var savedSH  = (savedCh.sub_headings && savedCh.sub_headings.length >= field.minSubHeadings)
                     ? savedCh.sub_headings
                     : [];
      var shCount = Math.max(savedSH.length, field.minSubHeadings);

      function renderSHRow(shIdx, savedRow) {
        var row = el('div', { className: 'subheading-row' });
        var hLbl = el('label', { 'for': key + '_sh_' + shIdx });
        hLbl.textContent = 'Sub-heading ' + (shIdx + 1);
        var hInp = el('input', { type: 'text', id: key + '_sh_' + shIdx, className: 'sh-heading', placeholder: 'e.g. Setting Up Your Environment' });
        hInp.value = (savedRow && savedRow.heading) ? savedRow.heading : '';

        var skLbl = el('label', { 'for': key + '_sk_' + shIdx });
        skLbl.textContent = 'Skill learned';
        var skInp = el('input', { type: 'text', id: key + '_sk_' + shIdx, className: 'sh-skill', placeholder: 'e.g. Install and configure the .NET SDK' });
        skInp.value = (savedRow && savedRow.skill) ? savedRow.skill : '';

        var removeBtn = el('button', { type: 'button', className: 'btn-icon btn-remove-sh', 'aria-label': 'Remove sub-heading ' + (shIdx + 1) });
        removeBtn.textContent = '✕';
        removeBtn.addEventListener('click', function () {
          var allRows = shList.querySelectorAll('.subheading-row');
          if (allRows.length > field.minSubHeadings) {
            row.parentNode.removeChild(row);
          } else {
            showInlineMsg(shSection, 'Minimum ' + field.minSubHeadings + ' sub-headings required.');
          }
        });

        row.appendChild(hLbl);
        row.appendChild(hInp);
        row.appendChild(skLbl);
        row.appendChild(skInp);
        row.appendChild(removeBtn);
        return row;
      }

      for (var si = 0; si < shCount; si++) {
        shList.appendChild(renderSHRow(si, savedSH[si]));
      }
      shSection.appendChild(shList);

      var addSHBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-sm' });
      addSHBtn.textContent = '+ Add Sub-Heading';
      addSHBtn.addEventListener('click', function () {
        var allRows = shList.querySelectorAll('.subheading-row');
        if (allRows.length < field.maxSubHeadings) {
          shList.appendChild(renderSHRow(allRows.length, null));
        } else {
          showInlineMsg(shSection, 'Maximum ' + field.maxSubHeadings + ' sub-headings per chapter.');
        }
      });
      shSection.appendChild(addSHBtn);

      // Chapter images
      var imageSection = el('div', { className: 'chapter-images-section' });
      var imageTitle = el('h4', {});
      imageTitle.textContent = 'Chapter Images';
      imageSection.appendChild(imageTitle);

      var imageHelp = el('p', { className: 'field-help' });
      imageHelp.textContent = 'Upload images that belong to this chapter. They will be committed to your GitHub repository.';
      imageSection.appendChild(imageHelp);

      var imageStore = el('input', { type: 'hidden', className: 'chapter-images-store' });
      var imageState = Array.isArray(savedCh.images) ? savedCh.images.slice() : [];
      imageStore.value = JSON.stringify(imageState);

      var imageInput = el('input', {
        type: 'file',
        className: 'chapter-image-input',
        accept: 'image/*',
        multiple: 'multiple'
      });

      var imageList = el('div', { className: 'chapter-image-list' });

      function renderImageList() {
        imageList.innerHTML = '';
        if (imageState.length === 0) {
          imageList.appendChild(el('p', { className: 'field-help' }, ['No images uploaded yet.']));
          return;
        }

        imageState.forEach(function (img, imgIdx) {
          var row = el('div', { className: 'chapter-image-row' });
          var name = el('span', { className: 'chapter-image-name' });
          name.textContent = img.name || ('image-' + (imgIdx + 1));
          var remove = el('button', { type: 'button', className: 'btn-icon', 'aria-label': 'Remove image ' + (imgIdx + 1) });
          remove.textContent = '✕';
          remove.addEventListener('click', function () {
            imageState.splice(imgIdx, 1);
            imageStore.value = JSON.stringify(imageState);
            renderImageList();
          });
          row.appendChild(name);
          row.appendChild(remove);
          imageList.appendChild(row);
        });
      }

      imageInput.addEventListener('change', function () {
        var files = Array.prototype.slice.call(imageInput.files || []);
        files.forEach(function (file) {
          var reader = new FileReader();
          pendingImageReads++;
          reader.onload = function (ev) {
            var result = ev.target && ev.target.result ? String(ev.target.result) : '';
            var base64 = result.indexOf(',') > -1 ? result.split(',')[1] : '';
            imageState.push({
              name: sanitizeFileName(file.name || 'image.png'),
              contentBase64: base64
            });
            imageStore.value = JSON.stringify(imageState);
            pendingImageReads--;
            renderImageList();
          };
          reader.onerror = function () {
            pendingImageReads--;
          };
          reader.readAsDataURL(file);
        });
        imageInput.value = '';
      });

      imageSection.appendChild(imageInput);
      imageSection.appendChild(imageStore);
      imageSection.appendChild(imageList);
      renderImageList();
      block.appendChild(imageSection);
      block.appendChild(shSection);
      wrap.appendChild(block);
    });

    return wrap;
  }

  function renderReviewerTables(field, savedData) {
    var wrap = el('div', { className: 'field-group' });
    var savedReviewers = (savedData && savedData.reviewers) ? savedData.reviewers : {};

    field.tables.forEach(function (table) {
      var tableWrap = el('div', { className: 'reviewer-table-wrap wizard-card' });
      var title = el('h3', {});
      title.textContent = table.label;
      tableWrap.appendChild(title);

      var domTable = el('table', { className: 'reviewer-table' });
      var thead = el('thead', {});
      var headerRow = el('tr', {});
      field.columns.forEach(function (col) {
        var th = el('th', {});
        th.textContent = col.label;
        headerRow.appendChild(th);
      });
      headerRow.appendChild(el('th', {})); // remove button column
      thead.appendChild(headerRow);
      domTable.appendChild(thead);

      var tbody = el('tbody', { id: 'reviewer-tbody-' + table.id });
      var savedRows = savedReviewers[table.id] || [{}];

      function addRow(rowData) {
        var row = el('tr', { className: 'reviewer-row', 'data-table': table.id });
        field.columns.forEach(function (col) {
          var td = el('td', {});
          var inp = el('input', { type: 'text', 'data-col': col.id, placeholder: col.label });
          inp.value = (rowData && rowData[col.id]) ? rowData[col.id] : '';
          td.appendChild(inp);
          row.appendChild(td);
        });
        var removeTd = el('td', {});
        var removeBtn = el('button', { type: 'button', className: 'btn-icon', 'aria-label': 'Remove row' });
        removeBtn.textContent = '✕';
        removeBtn.addEventListener('click', function () {
          row.parentNode.removeChild(row);
        });
        removeTd.appendChild(removeBtn);
        row.appendChild(removeTd);
        tbody.appendChild(row);
      }

      savedRows.forEach(function (r) { addRow(r); });
      domTable.appendChild(tbody);
      tableWrap.appendChild(domTable);

      var addRowBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-sm' });
      addRowBtn.textContent = '+ Add Row';
      addRowBtn.addEventListener('click', function () { addRow({}); });
      tableWrap.appendChild(addRowBtn);
      wrap.appendChild(tableWrap);
    });

    return wrap;
  }

  /* ------------------------------------------------------------------
   * Onboarding + GitHub sync
   * ------------------------------------------------------------------ */

  function toProjectId(username, repoName) {
    return (username || '').toLowerCase() + '/' + (repoName || '').toLowerCase();
  }

  function getResumeStepIndex() {
    var idx = 0;
    while (idx < WIZARD_SECTIONS.length) {
      var section = WIZARD_SECTIONS[idx];
      var data = WizardStorage.loadProgress(section.id);
      if (!data) {
        return idx;
      }
      idx++;
    }
    return 0;
  }

  function renderOnboarding(appEl) {
    appEl.innerHTML = '';
    var card = el('div', { className: 'wizard-card wizard-card--onboarding', id: 'main-content' });

    var title = el('h2', {});
    title.textContent = 'Sign in with GitHub to Start';
    card.appendChild(title);

    var desc = el('p', { className: 'section-description' });
    desc.textContent = 'Authenticate with GitHub, choose a new or existing book project, then continue the wizard. Each project writes markdown files into its own GitHub repository.';
    card.appendChild(desc);

    var oauthInfo = el('p', { className: 'field-help' });
    oauthInfo.textContent = 'You will be redirected to GitHub and returned here after sign-in.';
    card.appendChild(oauthInfo);

    var authMsg = el('p', { className: 'field-error', id: 'auth-error', role: 'alert', 'aria-live': 'polite' });
    card.appendChild(authMsg);

    var authActions = el('div', { className: 'nav-buttons' });
    var authBtn = el('button', { type: 'button', className: 'btn btn-primary' });
    authBtn.textContent = 'Sign in with GitHub';
    authBtn.addEventListener('click', function () {
      WizardGitHub.startOAuthRedirect(window.location.href);
    });
    authActions.appendChild(authBtn);
    card.appendChild(authActions);
    appEl.appendChild(card);
  }

  function consumeOAuthTicket(appEl) {
    var params = new URLSearchParams(window.location.search);
    var oauthFlag = params.get('oauth');

    if (!oauthFlag) {
      WizardGitHub.authenticate().then(function (user) {
        githubSession = {
          token: '',
          username: user && user.login ? user.login : ''
        };
        renderProjectSetup(appEl);
      }).catch(function () {
        renderOnboarding(appEl);
      });
      return;
    }

    var cleanedUrl = new URL(window.location.href);
    cleanedUrl.searchParams.delete('oauth');
    window.history.replaceState({}, '', cleanedUrl.toString());

    appEl.innerHTML = '';
    var loadingCard = el('div', { className: 'wizard-card wizard-card--onboarding', id: 'main-content' });
    var loadingTitle = el('h2', {});
    loadingTitle.textContent = 'Finishing Sign-In';
    loadingCard.appendChild(loadingTitle);
    loadingCard.appendChild(el('p', { className: 'section-description' }, ['Completing secure GitHub authentication...']));
    appEl.appendChild(loadingCard);

    WizardGitHub.completeOAuthSignIn()
      .then(function (user) {
        githubSession = {
          token: '',
          username: user && user.login ? user.login : ''
        };
        renderProjectSetup(appEl);
      })
      .catch(function (err) {
        renderOnboarding(appEl);
        var authErr = document.getElementById('auth-error');
        if (authErr) {
          authErr.textContent = 'GitHub OAuth sign-in failed: ' + (err && err.message ? err.message : 'unknown error');
        }
      });
  }

  function renderProjectSetup(appEl) {
    appEl.innerHTML = '';
    var card = el('div', { className: 'wizard-card wizard-card--onboarding', id: 'main-content' });
    var projects = WizardStorage.listProjectsForUser(githubSession.username);

    var title = el('h2', {});
    title.textContent = 'Welcome, ' + githubSession.username;
    card.appendChild(title);

    var desc = el('p', { className: 'section-description' });
    desc.textContent = 'Choose whether to start a new book or continue an existing one.';
    card.appendChild(desc);

    var modeWrap = el('div', { className: 'field-group project-mode' });
    var newModeId = 'project-mode-new';
    var continueModeId = 'project-mode-continue';

    var newLabel = el('label', { for: newModeId, className: 'mode-option' });
    var newRadio = el('input', { type: 'radio', id: newModeId, name: 'project_mode', value: 'new', checked: 'checked' });
    newLabel.appendChild(newRadio);
    newLabel.appendChild(document.createTextNode(' Start a new book'));

    var continueLabel = el('label', { for: continueModeId, className: 'mode-option' });
    var continueRadioAttrs = { type: 'radio', id: continueModeId, name: 'project_mode', value: 'continue' };
    if (projects.length === 0) {
      continueRadioAttrs.disabled = 'disabled';
    }
    var continueRadio = el('input', continueRadioAttrs);
    continueLabel.appendChild(continueRadio);
    continueLabel.appendChild(document.createTextNode(' Continue an existing book'));
    if (projects.length === 0) {
      continueLabel.appendChild(el('span', { className: 'field-help' }, [' (no saved books found for this account yet)']));
    }

    modeWrap.appendChild(newLabel);
    modeWrap.appendChild(continueLabel);
    card.appendChild(modeWrap);

    var newBookWrap = el('div', { className: 'field-group', id: 'new-book-wrap' });
    newBookWrap.appendChild(labelEl('Book Name', 'book-name-input'));
    var bookInput = el('input', { type: 'text', id: 'book-name-input', placeholder: 'e.g. Practical Cloud Architecture' });
    newBookWrap.appendChild(bookInput);
    card.appendChild(newBookWrap);

    var continueWrap = el('div', { className: 'field-group', id: 'continue-project-wrap', style: 'display:none;' });
    continueWrap.appendChild(labelEl('Select Existing Book', 'existing-project-select'));
    var select = el('select', { id: 'existing-project-select' });
    projects.forEach(function (project) {
      var option = el('option', { value: project.id });
      option.textContent = project.bookName + ' (' + project.repoOwner + '/' + project.repoName + ')';
      select.appendChild(option);
    });
    continueWrap.appendChild(select);
    card.appendChild(continueWrap);

    function updateModeVisibility() {
      var mode = document.querySelector('input[name="project_mode"]:checked');
      var value = mode ? mode.value : 'new';
      newBookWrap.style.display = value === 'new' ? '' : 'none';
      continueWrap.style.display = value === 'continue' ? '' : 'none';
    }

    newRadio.addEventListener('change', updateModeVisibility);
    continueRadio.addEventListener('change', updateModeVisibility);

    var err = el('p', { className: 'field-error', id: 'project-error', role: 'alert', 'aria-live': 'polite' });
    card.appendChild(err);

    var nav = el('div', { className: 'nav-buttons' });
    var backBtn = el('button', { type: 'button', className: 'btn btn-secondary' });
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', function () {
      githubSession = null;
      renderOnboarding(appEl);
    });
    nav.appendChild(backBtn);

    var startBtn = el('button', { type: 'button', className: 'btn btn-primary' });
    startBtn.textContent = 'Continue';
    startBtn.addEventListener('click', function () {
      err.textContent = '';
      startBtn.disabled = true;
      startBtn.textContent = 'Working...';

      var modeInput = document.querySelector('input[name="project_mode"]:checked');
      var mode = modeInput ? modeInput.value : 'new';

      if (mode === 'new') {
        var bookName = (bookInput.value || '').trim();
        if (!bookName) {
          err.textContent = 'Please enter a book name.';
          startBtn.disabled = false;
          startBtn.textContent = 'Continue';
          return;
        }

        createNewProject(bookName).then(function (project) {
          startWizardForProject(appEl, project, 0);
        }).catch(function (createErr) {
          err.textContent = 'Could not create book repository: ' + createErr.message;
          startBtn.disabled = false;
          startBtn.textContent = 'Continue';
        });
      } else {
        var selectedProjectId = select.value;
        var project = WizardStorage.getProject(selectedProjectId);
        if (!project) {
          err.textContent = 'Please select a valid project to continue.';
          startBtn.disabled = false;
          startBtn.textContent = 'Continue';
          return;
        }

        activeProject = project;
        WizardStorage.setActiveProject(project.id);
        WizardGitHub.getRepo(githubSession.token, project.repoOwner, project.repoName).then(function (repo) {
          if (!repo) {
            throw new Error('Repository not found.');
          }
          startWizardForProject(appEl, project, getResumeStepIndex());
        }).catch(function (loadErr) {
          err.textContent = 'Could not access existing repository: ' + loadErr.message;
          startBtn.disabled = false;
          startBtn.textContent = 'Continue';
        });
      }
    });
    nav.appendChild(startBtn);

    card.appendChild(nav);
    appEl.appendChild(card);
    updateModeVisibility();
  }

  function createNewProject(bookName) {
    var repoName = WizardGitHub.slugifyRepoName(bookName);
    var owner = githubSession.username;

    return WizardGitHub.createRepo(
      githubSession.token,
      repoName,
      'Book project for ' + bookName,
      true
    ).catch(function (err) {
      if (err.status === 422) {
        var fallbackRepoName = repoName + '-' + Date.now();
        return WizardGitHub.createRepo(githubSession.token, fallbackRepoName, 'Book project for ' + bookName, true);
      }
      throw err;
    }).then(function (repo) {
      var project = WizardStorage.saveProjectMeta({
        id: toProjectId(owner, repo.name),
        githubUsername: owner,
        bookName: bookName,
        repoOwner: owner,
        repoName: repo.name
      });
      WizardStorage.setActiveProject(project.id);
      activeProject = project;

      var initialFiles = {};
      initialFiles['README.md'] = '# ' + bookName + '\n\nThis repository was created by the Book Outline Wizard.\n';
      return WizardGitHub.upsertFiles(
        githubSession.token,
        project.repoOwner,
        project.repoName,
        initialFiles,
        'Initialize book repository'
      ).then(function () {
        return project;
      });
    });
  }

  function startWizardForProject(appEl, project, stepIndex) {
    activeProject = project;
    currentStep = typeof stepIndex === 'number' ? stepIndex : 0;
    renderStep(currentStep, appEl);
    focusFirstInput(appEl);
  }

  function syncProjectToGitHub(statusTargetEl, successMessage) {
    if (!githubSession || !activeProject) {
      return Promise.resolve();
    }

    var allData = WizardStorage.loadAllProgress();
    var fileMap = WizardExport.buildRepoFileMap(allData, activeProject.bookName);

    return WizardGitHub.upsertFiles(
      githubSession.token,
      activeProject.repoOwner,
      activeProject.repoName,
      fileMap,
      'Update outline and chapter markdown files'
    ).then(function () {
      if (statusTargetEl) {
        showStatusMsg(statusTargetEl, successMessage || 'Synced to GitHub repository.', 'success');
      }
    }).catch(function (err) {
      if (statusTargetEl) {
        showStatusMsg(statusTargetEl, 'Saved locally, but GitHub sync failed: ' + err.message, 'error');
      }
    });
  }

  /* ------------------------------------------------------------------
   * Render a single wizard step
   * ------------------------------------------------------------------ */

  function renderStep(stepIndex, appEl) {
    var section   = WIZARD_SECTIONS[stepIndex];
    var savedData = WizardStorage.loadProgress(section.id);

    appEl.innerHTML = '';

    // Progress bar
    var progressWrap = el('div', { className: 'progress-wrap', 'aria-label': 'Wizard progress', role: 'progressbar',
                                   'aria-valuenow': String(stepIndex + 1), 'aria-valuemin': '1', 'aria-valuemax': String(totalSteps),
                                   'aria-live': 'polite' });
    var progressBar  = el('div', { className: 'progress-bar' });
    var progressFill = el('div', { className: 'progress-fill' });
    var pct = Math.round(((stepIndex + 1) / totalSteps) * 100);
    progressFill.style.width = pct + '%';
    progressBar.appendChild(progressFill);
    var progressLabel = el('p', { className: 'progress-label' });
    progressLabel.textContent = 'Step ' + (stepIndex + 1) + ' of ' + totalSteps + ' (' + pct + '%)';
    progressWrap.appendChild(progressBar);
    progressWrap.appendChild(progressLabel);
    appEl.appendChild(progressWrap);

    // Card
    var card = el('div', { className: 'wizard-card', id: 'main-content' });

    if (activeProject) {
      var projectBadge = el('p', { className: 'project-badge' });
      projectBadge.textContent = 'Project: ' + activeProject.bookName + ' (' + activeProject.repoOwner + '/' + activeProject.repoName + ')';
      card.appendChild(projectBadge);
    }

    if (section.optional) {
      var optBadge = el('span', { className: 'optional-badge' });
      optBadge.textContent = 'Optional – Skip if not applicable';
      card.appendChild(optBadge);
    }

    var titleEl = el('h2', {});
    titleEl.textContent = section.title;
    card.appendChild(titleEl);

    var descEl = el('p', { className: 'section-description' });
    descEl.textContent = section.description;
    card.appendChild(descEl);

    // Error summary
    var errorSummary = el('div', { className: 'error-summary', id: 'error-summary', role: 'alert', 'aria-live': 'assertive' });
    errorSummary.style.display = 'none';
    card.appendChild(errorSummary);

    // Fields
    var fieldsWrap = el('div', { className: 'fields-wrap' });
    section.fields.forEach(function (field) {
      var fieldEl;
      switch (field.type) {
        case 'text':           fieldEl = renderTextField(field, savedData ? savedData[field.id] : null); break;
        case 'textarea':       fieldEl = renderTextareaField(field, savedData ? savedData[field.id] : null); break;
        case 'number':         fieldEl = renderTextField(field, savedData ? savedData[field.id] : null); break;
        case 'char-counter':   fieldEl = renderCharCounterField(field, savedData ? savedData[field.id] : null); break;
        case 'dynamic-list':   fieldEl = renderDynamicList(field, savedData ? savedData[field.id] : null); break;
        case 'dynamic-group':  fieldEl = renderDynamicGroup(field, savedData ? savedData[field.id] : null); break;
        case 'parts-chapters': fieldEl = renderPartsChapters(field, savedData); break;
        case 'chapter-outlines': fieldEl = renderChapterOutlines(field, savedData); break;
        case 'reviewer-tables':  fieldEl = renderReviewerTables(field, savedData); break;
        default: fieldEl = null;
      }
      if (fieldEl) { fieldsWrap.appendChild(fieldEl); }
    });
    card.appendChild(fieldsWrap);

    // Navigation buttons
    var navWrap = el('div', { className: 'nav-buttons' });

    if (stepIndex > 0) {
      var prevBtn = el('button', { type: 'button', className: 'btn btn-secondary', id: 'btn-prev' });
      prevBtn.textContent = '← Previous';
      prevBtn.addEventListener('click', function () {
        // Save without validation before going back
        WizardStorage.saveProgress(section.id, collectSectionData(section));
        currentStep--;
        renderStep(currentStep, appEl);
        focusFirstInput(appEl);
      });
      navWrap.appendChild(prevBtn);
    }

    var saveBtn = el('button', { type: 'button', className: 'btn btn-secondary', id: 'btn-save' });
    saveBtn.textContent = '💾 Save & Continue Later';
    saveBtn.addEventListener('click', function () {
      WizardStorage.saveProgress(section.id, collectSectionData(section));
      syncProjectToGitHub(appEl, '✅ Progress saved and synced! You can close this tab and return later.');
    });
    navWrap.appendChild(saveBtn);

    var nextBtn = el('button', { type: 'button', className: 'btn btn-primary', id: 'btn-next' });
    nextBtn.textContent = stepIndex < totalSteps - 1 ? 'Next →' : '📋 Review & Export';
    nextBtn.addEventListener('click', function () {
      if (pendingImageReads > 0) {
        showInlineMsg(card, 'Please wait for image uploads to finish before continuing.');
        return;
      }
      clearValidationErrors(card);
      var data   = collectSectionData(section);
      var errors = validateSection(section, data);
      if (errors.length > 0) {
        showErrors(card, errors);
        return;
      }
      WizardStorage.saveProgress(section.id, data);

      syncProjectToGitHub(appEl).finally(function () {
        if (stepIndex < totalSteps - 1) {
          currentStep++;
          renderStep(currentStep, appEl);
          focusFirstInput(appEl);
        } else {
          renderReview(appEl);
        }
      });
    });
    navWrap.appendChild(nextBtn);

    card.appendChild(navWrap);
    appEl.appendChild(card);
  }

  /* ------------------------------------------------------------------
   * Review & Export screen
   * ------------------------------------------------------------------ */

  function renderReview(appEl) {
    appEl.innerHTML = '';
    var card = el('div', { className: 'wizard-card', id: 'main-content' });

    var titleEl = el('h2', {});
    titleEl.textContent = '📋 Review & Export';
    card.appendChild(titleEl);

    var desc = el('p', { className: 'section-description' });
    desc.textContent = 'Review your outline below. Sync to GitHub to keep repository markdown up to date, or download a ZIP copy.';
    card.appendChild(desc);

    if (activeProject) {
      var activeRepo = el('p', { className: 'field-help' });
      activeRepo.textContent = 'Repository: ' + activeProject.repoOwner + '/' + activeProject.repoName;
      card.appendChild(activeRepo);
    }

    // Summary
    var allData = WizardStorage.loadAllProgress();
    var summaryEl = el('div', { className: 'review-summary' });

    WIZARD_SECTIONS.forEach(function (section) {
      var secData = allData[section.id];
      var secEl   = el('div', { className: 'review-section' });
      var secH    = el('h3', {});
      secH.textContent = section.title;
      secEl.appendChild(secH);

      if (!secData) {
        var empty = el('p', { className: 'review-empty' });
        empty.textContent = section.optional ? 'Skipped (optional)' : 'Not completed.';
        secEl.appendChild(empty);
      } else {
        var preview = el('pre', { className: 'review-preview' });
        preview.textContent = JSON.stringify(secData, null, 2).substring(0, 500) + (JSON.stringify(secData).length > 500 ? '\n…' : '');
        secEl.appendChild(preview);
      }
      summaryEl.appendChild(secEl);
    });

    card.appendChild(summaryEl);

    // Buttons
    var navWrap = el('div', { className: 'nav-buttons' });

    var prevBtn = el('button', { type: 'button', className: 'btn btn-secondary' });
    prevBtn.textContent = '← Back';
    prevBtn.addEventListener('click', function () {
      currentStep = totalSteps - 1;
      renderStep(currentStep, appEl);
      focusFirstInput(appEl);
    });
    navWrap.appendChild(prevBtn);

    var exportBtn = el('button', { type: 'button', className: 'btn btn-primary' });
    exportBtn.textContent = '⬇ Download ZIP';
    exportBtn.addEventListener('click', function () {
      WizardExport.downloadAllAsZip();
    });
    navWrap.appendChild(exportBtn);

    if (activeProject) {
      var syncBtn = el('button', { type: 'button', className: 'btn btn-secondary' });
      syncBtn.textContent = '🔁 Sync to GitHub';
      syncBtn.addEventListener('click', function () {
        syncBtn.disabled = true;
        syncBtn.textContent = 'Syncing...';
        syncProjectToGitHub(appEl, 'Outline and chapter markdown files synced to GitHub.').finally(function () {
          syncBtn.disabled = false;
          syncBtn.textContent = '🔁 Sync to GitHub';
        });
      });
      navWrap.appendChild(syncBtn);
    }

    var startOverBtn = el('button', { type: 'button', className: 'btn btn-danger' });
    startOverBtn.textContent = '🗑 Start Over';
    startOverBtn.addEventListener('click', function () {
      if (WizardStorage.clearProgress()) {
        currentStep = 0;
        renderStep(currentStep, appEl);
        focusFirstInput(appEl);
      }
    });
    navWrap.appendChild(startOverBtn);

    card.appendChild(navWrap);
    appEl.appendChild(card);
  }

  /* ------------------------------------------------------------------
   * UI helpers
   * ------------------------------------------------------------------ */

  function showErrors(card, errors) {
    var summary = document.getElementById('error-summary');
    if (!summary) { return; }
    summary.innerHTML = '';
    summary.style.display = 'block';
    var p = el('p', {});
    p.textContent = 'Please fix the following errors:';
    var ul = el('ul', {});
    errors.forEach(function (e) {
      var li = el('li', {});
      li.textContent = e.message;
      ul.appendChild(li);
      // Also mark individual field
      var errField = document.getElementById(e.fieldId + '-error');
      if (errField) { errField.textContent = e.message; }
    });
    summary.appendChild(p);
    summary.appendChild(ul);
    summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function clearValidationErrors(card) {
    var summary = document.getElementById('error-summary');
    if (summary) {
      summary.innerHTML = '';
      summary.style.display = 'none';
    }
    var fieldErrors = card.querySelectorAll('.field-error');
    fieldErrors.forEach(function (fieldError) {
      if (fieldError.id && fieldError.id.indexOf('-error') > -1) {
        fieldError.textContent = '';
      }
    });
  }

  function showStatusMsg(appEl, message, type) {
    var existing = appEl.querySelector('.status-msg');
    if (existing) { existing.parentNode.removeChild(existing); }
    var msg = el('div', { className: 'status-msg status-msg--' + type, role: 'status', 'aria-live': 'polite' });
    msg.textContent = message;
    appEl.insertBefore(msg, appEl.firstChild);
    setTimeout(function () {
      if (msg.parentNode) { msg.parentNode.removeChild(msg); }
    }, 4000);
  }

  function showInlineMsg(parentEl, message) {
    var existing = parentEl.querySelector('.inline-msg');
    if (existing) { parentEl.removeChild(existing); }
    var msg = el('p', { className: 'inline-msg field-error' });
    msg.textContent = message;
    parentEl.appendChild(msg);
    setTimeout(function () {
      if (msg.parentNode) { msg.parentNode.removeChild(msg); }
    }, 3000);
  }

  function focusFirstInput(appEl) {
    var first = appEl.querySelector('input, textarea, button');
    if (first) { first.focus(); }
  }

  /* ------------------------------------------------------------------
   * Initialisation
   * ------------------------------------------------------------------ */

  function init() {
    // Only run on the wizard page
    var appEl = document.getElementById('wizard-app');
    if (!appEl) { return; }

    if (!window.WIZARD_SECTIONS || !window.WizardStorage || !window.WizardExport || !window.WizardGitHub) {
      var loadingEl = document.getElementById('wizard-loading');
      if (loadingEl) {
        loadingEl.textContent = 'Error: wizard scripts failed to load. Please refresh the page.';
      }
      return;
    }

    totalSteps = WIZARD_SECTIONS.length;
    consumeOAuthTicket(appEl);
    focusFirstInput(appEl);
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
