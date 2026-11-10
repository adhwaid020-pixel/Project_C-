# ✈️ AEROVA — Airline Reservation System

This directory contains both the **C++17 System** and the **Full-Stack Web Application** (Python + SQLite + HTML/CSS/JS).

---

## 📁 Directory Structure

```
Project C++/
├── main.cpp            # C++17 complete console system
├── airline_system      # Compiled C++ executable
├── Makefile            # C++ build file
│
├── app.py              # Web App Backend (Python HTTP & REST API)
├── database.py         # Database schema & flight/seat seeder
├── airline.db          # SQLite pre-seeded database
├── test_app.py         # Automated test suite
├── start.sh            # 1-click startup script for web app
│
├── static/             # Web App Frontend
│   ├── index.html      # Single Page App layout with booking stepper
│   ├── css/styles.css  # Dark-theme airline design & boarding pass
│   └── js/app.js       # Interactive seat map, checkout & payment engine
│
└── .vscode/
    └── launch.json     # 1-click launch configurations for VS Code
```

---

## 🚀 How to Run

### 1. Run the Full-Stack Web App:
```bash
cd "/Users/adhwaidprasad/Documents/Project C++"
python3 app.py
```
*Then open your browser at:* **http://localhost:8080**

### 2. Run the C++ System:
```bash
cd "/Users/adhwaidprasad/Documents/Project C++"
./airline_system
```
*(Or compile with `make run`)*
# Project_C-
