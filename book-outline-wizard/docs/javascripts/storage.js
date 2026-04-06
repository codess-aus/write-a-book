/**
 * storage.js
 * localStorage helpers for saving and loading wizard progress.
 */

/* global window */

(function () {
  'use strict';

  var KEY_PREFIX = 'bookOutline_';
  var PROJECTS_KEY = KEY_PREFIX + 'projects_v1';
  var ACTIVE_PROJECT_KEY = KEY_PREFIX + 'active_project_v1';

  function getSectionKey(sectionId) {
    var activeProjectId = getActiveProjectId();
    if (activeProjectId) {
      return KEY_PREFIX + activeProjectId + '_' + sectionId;
    }
    return KEY_PREFIX + sectionId;
  }

  /**
   * Save the data for a single section.
   * @param {string} sectionId
   * @param {*} data  - any JSON-serialisable value
   */
  function saveProgress(sectionId, data) {
    try {
      window.localStorage.setItem(getSectionKey(sectionId), JSON.stringify(data));
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
      var raw = window.localStorage.getItem(getSectionKey(sectionId));
      if (raw !== null) {
        return JSON.parse(raw);
      }
      // Backward compatibility with older single-project keys.
      var legacyRaw = window.localStorage.getItem(KEY_PREFIX + sectionId);
      return legacyRaw !== null ? JSON.parse(legacyRaw) : null;
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
      var activeProjectId = getActiveProjectId();
      window.WIZARD_SECTIONS.forEach(function (section) {
        try {
          if (activeProjectId) {
            window.localStorage.removeItem(KEY_PREFIX + activeProjectId + '_' + section.id);
          } else {
            window.localStorage.removeItem(KEY_PREFIX + section.id);
          }
        } catch (e) {
          console.warn('Could not remove key for section "' + section.id + '":', e);
        }
      });
    }
    return true;
  }

  function parseProjects(raw) {
    if (!raw) { return []; }
    try {
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function listProjects() {
    return parseProjects(window.localStorage.getItem(PROJECTS_KEY));
  }

  function saveProjects(projects) {
    window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  }

  function saveProjectMeta(meta) {
    var projects = listProjects();
    var idx = -1;
    var nowIso = new Date().toISOString();
    var enriched = {
      id: meta.id,
      githubUsername: meta.githubUsername,
      bookName: meta.bookName,
      repoOwner: meta.repoOwner,
      repoName: meta.repoName,
      createdAt: meta.createdAt || nowIso,
      updatedAt: nowIso
    };

    projects.forEach(function (p, i) {
      if (p.id === meta.id) {
        idx = i;
      }
    });

    if (idx >= 0) {
      projects[idx] = enriched;
    } else {
      projects.push(enriched);
    }
    saveProjects(projects);
    return enriched;
  }

  function listProjectsForUser(githubUsername) {
    var uname = (githubUsername || '').toLowerCase();
    return listProjects().filter(function (p) {
      return (p.githubUsername || '').toLowerCase() === uname;
    });
  }

  function getProject(projectId) {
    var found = null;
    listProjects().forEach(function (p) {
      if (p.id === projectId) {
        found = p;
      }
    });
    return found;
  }

  function setActiveProject(projectId) {
    window.localStorage.setItem(ACTIVE_PROJECT_KEY, projectId || '');
  }

  function getActiveProjectId() {
    return window.localStorage.getItem(ACTIVE_PROJECT_KEY);
  }

  function getActiveProject() {
    var projectId = getActiveProjectId();
    return projectId ? getProject(projectId) : null;
  }

  function hasAnyProgress(projectId) {
    if (!window.WIZARD_SECTIONS || !projectId) { return false; }
    return window.WIZARD_SECTIONS.some(function (section) {
      return window.localStorage.getItem(KEY_PREFIX + projectId + '_' + section.id) !== null;
    });
  }

  // Expose on window
  window.WizardStorage = {
    saveProgress: saveProgress,
    loadProgress: loadProgress,
    loadAllProgress: loadAllProgress,
    clearProgress: clearProgress,
    saveProjectMeta: saveProjectMeta,
    listProjects: listProjects,
    listProjectsForUser: listProjectsForUser,
    getProject: getProject,
    setActiveProject: setActiveProject,
    getActiveProjectId: getActiveProjectId,
    getActiveProject: getActiveProject,
    hasAnyProgress: hasAnyProgress
  };
}());
