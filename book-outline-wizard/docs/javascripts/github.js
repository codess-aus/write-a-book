/**
 * github.js
 * Lightweight GitHub REST API helper for auth validation, repository creation,
 * and committing markdown files from the wizard.
 */

/* global window */

(function () {
  'use strict';

  var API_BASE = 'https://api.github.com';

  function request(method, path, token, body, accept404) {
    var headers = {
      'Accept': 'application/vnd.github+json'
    };
    if (token) {
      headers.Authorization = 'Bearer ' + token;
    }
    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    return window.fetch(API_BASE + path, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      if (accept404 && res.status === 404) {
        return null;
      }
      return res.text().then(function (text) {
        var payload = text ? JSON.parse(text) : {};
        if (!res.ok) {
          var err = new Error((payload && payload.message) || ('GitHub API error (' + res.status + ')'));
          err.status = res.status;
          err.payload = payload;
          throw err;
        }
        return payload;
      });
    });
  }

  function slugifyRepoName(bookName) {
    var slug = (bookName || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!slug) {
      slug = 'book-outline';
    }
    if (slug.length > 95) {
      slug = slug.substring(0, 95);
    }
    return slug;
  }

  function encodeBase64Utf8(text) {
    return window.btoa(unescape(encodeURIComponent(text || '')));
  }

  function authenticate(token) {
    return request('GET', '/user', token, null, false);
  }

  function getRepo(token, owner, repo) {
    return request('GET', '/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo), token, null, true);
  }

  function createRepo(token, repoName, description, isPrivate) {
    return request('POST', '/user/repos', token, {
      name: repoName,
      description: description || '',
      homepage: '',
      private: !!isPrivate,
      auto_init: true
    }, false);
  }

  function getFile(token, owner, repo, filePath) {
    var encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
    return request('GET', '/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/contents/' + encodedPath, token, null, true);
  }

  function upsertFile(token, owner, repo, filePath, content, message, rawBase64) {
    return getFile(token, owner, repo, filePath).then(function (existing) {
      var payload = {
        message: message,
        content: rawBase64 ? content : encodeBase64Utf8(content)
      };
      if (existing && existing.sha) {
        payload.sha = existing.sha;
      }
      var encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
      return request('PUT', '/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/contents/' + encodedPath, token, payload, false);
    });
  }

  function upsertFiles(token, owner, repo, fileMap, commitMessage) {
    var paths = Object.keys(fileMap || {});
    var results = [];

    return paths.reduce(function (chain, filePath) {
      return chain.then(function () {
        var value = fileMap[filePath];
        var content = value;
        var rawBase64 = false;

        if (value && typeof value === 'object' && value.content) {
          content = value.content;
          rawBase64 = !!value.rawBase64;
        }

        return upsertFile(token, owner, repo, filePath, content, commitMessage, rawBase64).then(function (result) {
          results.push({ filePath: filePath, result: result });
        });
      });
    }, Promise.resolve()).then(function () {
      return results;
    });
  }

  window.WizardGitHub = {
    authenticate: authenticate,
    slugifyRepoName: slugifyRepoName,
    getRepo: getRepo,
    createRepo: createRepo,
    upsertFile: upsertFile,
    upsertFiles: upsertFiles
  };
}());
