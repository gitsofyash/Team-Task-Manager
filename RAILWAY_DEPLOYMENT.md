# Railway Deployment Guide

Use this checklist after pushing the project to GitHub.

## 1. Create Railway Project

1. Go to Railway.
2. Click **New Project**.
3. Choose **Deploy from GitHub repo**.
4. Select this repository.

Railway will detect Node.js and use:

```bash
npm start
```

The `railway.json` file already sets the start command.

## 2. Add PostgreSQL

1. In the Railway project, click **New**.
2. Select **Database**.
3. Choose **PostgreSQL**.
4. Open the PostgreSQL service and copy its `DATABASE_URL`.

## 3. Add Variables to the App Service

Open the web app service, then add these variables:

```env
DATABASE_URL=your-railway-postgres-url
JWT_SECRET=make-this-a-long-random-secret
NODE_ENV=production
```

Railway usually exposes the database URL automatically if the app and database are in the same project. If it does, confirm that `DATABASE_URL` is visible in the app service variables.

## 4. Initialize Tables

Run this once in the Railway app service shell:

```bash
npm run db:init
```

Optional demo data:

```bash
npm run db:seed
```

Demo password for all seeded users:

```text
Password123
```

## 5. Open the App

Use the Railway generated domain for the web service. Login with:

```text
admin@example.com
Password123
```

## Troubleshooting

If deployment starts but login fails, check:

- `DATABASE_URL` exists in the app service variables.
- `JWT_SECRET` exists.
- `npm run db:init` was run successfully.
- The app service logs do not show database connection errors.
