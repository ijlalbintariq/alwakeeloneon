# Cause List Scraper - GitHub Actions Setup Guide

I wrote a standalone script (`server/scraper-action.ts`) that allows you to offload the heavy PDF parsing of Supreme Court and High Court cause lists to Microsoft's GitHub servers completely for free. 

Because Node.js is single-threaded, running the scraper on your main Render.com server freezes the website (uses 100% CPU). Running it on GitHub Actions ensures your main website stays fast, and GitHub provides a fresh server with a different IP address, preventing the Pakistani court websites from blocking you.

## How to Enable It

When you are ready to use this in the future, follow these 3 steps:

### 1. Push the Code
Make sure these two files are pushed to your GitHub repository (either on `main` or another branch):
- `server/scraper-action.ts`
- `.github/workflows/cause-list-scraper.yml`

### 2. Give GitHub your Database Password
Because the scraper runs on GitHub's servers, it needs your database connection string so it can save the scraped hearings directly into your Neon Database.

1. Open your web browser and go to your **GitHub Repository**.
2. Click on the **Settings** tab (the gear icon at the top right).
3. On the left sidebar, scroll down to **Secrets and variables** and click **Actions**.
4. Click the green button: **New repository secret**.
5. In the **Name** field, type exactly: `DATABASE_URL`
6. In the **Secret** field, paste your Neon PostgreSQL connection string (the exact same one you use on Render).
7. Click **Add secret**.

### 3. Test It (Optional)
The script is programmed to automatically run 4 times a day (18:00, 20:30, 22:30, and 07:30 PKT). You don't have to do anything.

However, if you want to test it right now:
1. Go to your GitHub Repository and click the **Actions** tab at the top.
2. On the left sidebar, click **Cause List Scraper**.
3. On the right side, click the **Run workflow** dropdown button, and click the green **Run workflow** button.
4. You will see a yellow spinning circle appear. Click it to watch the logs as GitHub boots up a server, downloads the PDFs, matches them to your users' Case Files, and saves the data directly to your Neon database!
