/**
 * config.js
 * Runtime config for OAuth backend URL. Override by setting window.WIZARD_CONFIG
 * before this script, or append ?oauth_server=https://your-server.
 */

/* global window */

(function () {
  'use strict';

  var existing = window.WIZARD_CONFIG || {};
  var qs = new URLSearchParams(window.location.search);
  var oauthFromQuery = qs.get('oauth_server');

  // OAUTH_SERVER_URL is replaced at build time by the GitHub Actions workflow.
  // Falls back to localhost for local development.
  var defaultUrl = 'http://localhost:8787';

  window.WIZARD_CONFIG = {
    oauthServerUrl: oauthFromQuery || existing.oauthServerUrl || defaultUrl
  };
}());
