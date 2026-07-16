# 🎓 My Smart Planner

**An all-in-one student productivity system** — assignments, exams, courses, daily planning, habits, workouts, budgeting, and notes, all in a single organized dashboard.

🔗 **Live App:** [my-smart-planner-anantbhrds-projects.vercel.app](https://my-smart-planner-anantbhrds-projects.vercel.app/)
📦 **Repository:** [MY-SMART-PLANNER](https://github.com/Anantbhrd/MY-SMART-PLANNER-.git)

---

## 📖 About

My Smart Planner was built by **Anant Bhardwaj** originally as a personal tool to stay on top of college life — juggling assignments, exams, workouts, and a budget all at once. It grew into a full productivity system, and is now open for anyone to use.

The idea is simple: instead of jumping between a to-do app, a calendar, a notes app, a habit tracker, and a budgeting spreadsheet, everything lives in one clean workspace.

---

## ✨ Features

### 🏠 Dashboard
- At-a-glance stats: pending assignments, upcoming exams, completion rate, and daily habit progress
- Next exam countdown banner
- Semester progress bar
- Fully customizable dashboard layout

### 📝 Assignments
- Track assignments by course, due date, priority, and status (Not Started / In Progress / Done)
- Filter and search across all assignments

### 📋 Exams
- Organized into External, Internal, and Practical exam categories
- Filter by upcoming, passed, or completed
- Priority-tagged exam cards

### 📚 Courses
- Manage active, upcoming, and completed courses
- Track grades per course

### 🗓️ Daily Planner & To-Do List
- Day-by-day schedule grid
- Study hours logging
- Dedicated to-do list view

### 🎯 Habit Tracker
- Daily habit tracking with completion percentage

### 💪 Workout
- Create and assign workout plans
- Log gym machines by category (Cardio, Strength, Flexibility, Free Weights, etc.)
- Track other activities (e.g., Badminton) with duration and calories
- Full workout history log

### 💰 Budget Tracker
- Set a monthly budget and track spending by category (Food, Study, Transport, Entertainment, etc.)
- Auto-calculated remaining balance, daily average, and a recommended "safe daily spend"
- Multi-currency support and past-month history

### 🗒️ Notes
- Quick text notes with search
- Photo uploads and gallery view

### 📊 Stats & Progress
- Visual charts (bar / line / pie) for study hours, assignment completion, workout activity, and semester-over-semester comparison
- Filter by time range (today, week, month, year, all time)

### 🔐 Account & Sync
- Sign in with Google to sync data across devices via Firebase
- "Continue Offline" mode using local browser storage
- Light/Dark theme toggle
- Live clock with timezone selection
- Reminder notifications for tasks and habits

---

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (no frameworks)
- **Backend / Sync:** [Firebase](https://firebase.google.com/) (Authentication + Firestore for cloud sync, Storage for photo uploads)
- **Offline Support:** Browser `localStorage`
- **Charts:** Custom hand-drawn charts rendered on HTML `<canvas>`
- **Hosting:** [Vercel](https://vercel.com/)
- **Fonts:** [Inter](https://fonts.google.com/specimen/Inter) via Google Fonts

---

## 🚀 Getting Started

### Try it online
Just visit the live app — no installation needed:
👉 **[my-smart-planner-anantbhrds-projects.vercel.app](https://my-smart-planner-anantbhrds-projects.vercel.app/)**

### Run it locally

```bash
# Clone the repository
git clone https://github.com/Anantbhrd/MY-SMART-PLANNER-.git

# Move into the project folder
cd MY-SMART-PLANNER-

# Open index.html directly in your browser
# or serve it locally, e.g.:
npx serve .
```

> **Note:** To use Google sign-in and cloud sync, you'll need to connect your own [Firebase project](https://console.firebase.google.com/) and replace the Firebase config in `app.js` with your own credentials. Without this, the app still works fully in **offline mode**.

---

## 📁 Project Structure

```
MY-SMART-PLANNER-/
├── index.html      # App structure & views (dashboard, assignments, exams, etc.)
├── style.css       # Styling, themes (light/dark), and layout
├── app.js          # App logic, Firebase integration, charts, state management
└── README.md
```

---

## 👤 Author

**Anant Bhardwaj**
Made for personal use, now shared publicly for anyone who wants a single place to plan their student life.

---

## 📄 License

This project currently has no formal license attached. If you'd like to reuse or build on it, feel free to reach out to the author.

---

⭐ If you find this useful, consider starring the repo!
