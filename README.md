# write-a-book

A book outline wizard that syncs your work to a GitHub repository. The frontend is a static MkDocs site (GitHub Pages) and the OAuth backend runs on Azure App Service.

## Architecture

| Component | Hosting | Purpose |
|---|---|---|
| Frontend wizard | GitHub Pages | The MkDocs static site at `/wizard/` |
| OAuth server | Azure App Service (Node.js) | Handles GitHub OAuth and proxies GitHub API calls — tokens never reach the browser |

## Deploying

### 1. Create a GitHub OAuth App

1. Go to **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**
2. Set **Homepage URL** to `https://<your-user>.github.io/write-a-book/wizard/`
3. Set **Authorization callback URL** to `https://<your-app>.azurewebsites.net/auth/github/callback`
4. Note the **Client ID** and generate a **Client Secret**

### 2. Deploy the OAuth server to Azure App Service

1. Create an **Azure App Service** (Linux, Node 20 LTS)
2. In the App Service → **Configuration → App settings**, add:

   | Name | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `GITHUB_CLIENT_ID` | *(from OAuth App above)* |
   | `GITHUB_CLIENT_SECRET` | *(from OAuth App above)* |
   | `SESSION_SECRET` | *(long random string — e.g. `openssl rand -hex 32`)* |
   | `OAUTH_BASE_URL` | `https://<your-app>.azurewebsites.net` |
   | `FRONTEND_ORIGIN` | `https://<your-user>.github.io` |
   | `FRONTEND_RETURN_URL` | `https://<your-user>.github.io/write-a-book/wizard/` |

3. Download the **Publish Profile** from the App Service Overview page
4. In your GitHub repo, add two Actions values:
   - **Secret** `AZURE_WEBAPP_PUBLISH_PROFILE` — paste the publish profile XML
   - **Variable** `AZURE_WEBAPP_NAME` — your App Service name (e.g. `write-a-book-oauth`)

5. Push to `main` (or run the **Deploy OAuth Server to Azure App Service** workflow manually). The workflow deploys `book-outline-wizard/oauth-server/` automatically on every push that changes that directory.

### 3. Configure the GitHub Pages frontend

Add a **Variable** in your GitHub repo (not a secret):

| Name | Value |
|---|---|
| `OAUTH_SERVER_URL` | `https://<your-app>.azurewebsites.net` |

This is injected into `config.js` at Pages build time. Push to `main` to trigger a Pages rebuild.

## Local development

```bash
# Terminal 1 — OAuth server
cd book-outline-wizard/oauth-server
cp .env.example .env   # fill in GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET
npm install
npm run dev

# Terminal 2 — MkDocs site
cd book-outline-wizard
pip install -r requirements.txt
mkdocs serve
```

Open `http://127.0.0.1:8000/wizard/` in your browser.
