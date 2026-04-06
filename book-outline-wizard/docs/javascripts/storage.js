/**
 * storage.js
 * localStorage helpers for saving and loading wizard progress.
 */

/* global window */

(function () {
  'use strict';

  var KEY_PREFIX = 'bookOutline_';

  /**
   * Save the data for a single section.
   * @param {string} sectionId
   * @param {*} data  - any JSON-serialisable value
   */
  function saveProgress(sectionId, data) {
    try {
      window.localStorage.setItem(KEY_PREFIX + sectionId, JSON.stringify(data));
    } catch (e) {
      // localStorage may be unavailable (e.g. private browsing quota exceeded)
      console.warn('Could not save progress for section "' + sectionId + '":', e);
    }
  }

  /**
   * Load the data for a single section.
   * @param  {string} sectionId
   * @return {*} parsed value, or null if not found
   */
  function loadProgress(sectionId) {
    try {
      var raw = window.localStorage.getItem(KEY_PREFIX + sectionId);
      return raw !== null ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('Could not load progress for section "' + sectionId + '":', e);
      return null;
    }
  }

  /**
   * Load data for every section defined in WIZARD_SECTIONS.
   * @return {Object} map of sectionId -> data (null if not saved)
   */
  function loadAllProgress() {
    var all = {};
    if (window.WIZARD_SECTIONS) {
      window.WIZARD_SECTIONS.forEach(function (section) {
        all[section.id] = loadProgress(section.id);
      });
    }
    return all;
  }

  /**
   * Remove all saved wizard data.
   * Shows a confirmation dialog before deleting.
   * @return {boolean} true if data was cleared, false if cancelled
   */
  function clearProgress() {
    if (!window.confirm('Are you sure you want to clear all saved progress? This cannot be undone.')) {
      return false;
    }
    if (window.WIZARD_SECTIONS) {
      window.WIZARD_SECTIONS.forEach(function (section) {
        try {
          window.localStorage.removeItem(KEY_PREFIX + section.id);
        } catch (e) {
          console.warn('Could not remove key for section "' + section.id + '":', e);
        }
      });
    }
    return true;
  }

  // Expose on window
  window.WizardStorage = {
    saveProgress: saveProgress,
    loadProgress: loadProgress,
    loadAllProgress: loadAllProgress,
    clearProgress: clearProgress
  };
}());
