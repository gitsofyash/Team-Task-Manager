# Team Task Manager

A full-stack assignment project where admins create projects, manage teams, assign tasks, and track project progress. Members can see their assigned work and update task status.

## Features

- Signup and login with JWT authentication
- Admin and Member roles
- Project creation and team membership management
- Task creation, assignment, due dates, and status tracking
- Dashboard stats for total tasks, status split, overdue tasks, and project progress
- REST APIs backed by PostgreSQL
- Railway deployment configuration

## Tech Stack

- Node.js + Express
- PostgreSQL
- JWT + bcryptjs
- Static HTML/CSS/JavaScript frontend served by Express

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` from `.env.example` and set `DATABASE_URL` and `JWT_SECRET`.

3. Initialize the database:

   ```bash
   npm run db:init
   ```

4. Optional: add demo users, projects, members, and tasks:

   ```bash
   npm run db:seed
   ```

   Demo login password for all seeded users is `Password123`.

5. Start the app:

   ```bash
   npm run dev
   ```

Open `http://localhost:3000`.

## Railway Deployment

1. Push this project to GitHub.
2. Create a Railway project from the repo.
3. Add a PostgreSQL service in Railway.
4. Add environment variables:
   - `DATABASE_URL` from the Railway PostgreSQL plugin
   - `JWT_SECRET` with a long random value
   - `NODE_ENV=production`
5. Run the migration command once from Railway shell or locally against the Railway database:

   ```bash
   npm run db:init
   ```

Railway will use `npm start` from `railway.json`.

See `RAILWAY_DEPLOYMENT.md` for a step-by-step deployment checklist.

## Demo Flow

1. Sign up as an Admin.
2. Create a project.
3. Add members by email to the project team.
4. Create tasks and assign them to team members.
5. Members log in and update task statuses.
