# 🎨 AI Prompt Battle

An interactive, real-time **AI Prompt Competition Platform** where participants compete by creating the best prompts for visual challenges and **vote for the submissions they like the most**.

The platform is designed for college clubs, workshops, hackathons, tech events, and team-based competitions.

---

## 🚀 Overview

**AI Prompt Battle** turns prompt engineering into a live competitive experience.

Participants join a competition by scanning a **QR code** displayed on the main screen. Once they join, they receive a visual challenge and create a prompt that could generate an image similar to the given reference.

After submissions are completed, the participants themselves view the submitted entries and **vote for the one they think is the best**.

The system automatically counts the votes and declares the winner of each round.

Admins or club leads are responsible only for **managing and controlling the competition**. They do not decide which submission wins.

---

# 🎯 How It Works

```text
                    ┌────────────────────┐
                    │ Admin Creates      │
                    │ Competition        │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │ QR Code Displayed  │
                    └─────────┬──────────┘
                              │
                     Participants Scan
                              │
                              ▼
                    ┌────────────────────┐
                    │ Join Competition   │
                    │  as Participant    │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │ Random Challenge   │
                    │      Image         │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │ Participants      │
                    │ Submit Prompts    │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │ Submissions        │
                    │ Displayed          │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │ Participants      │
                    │ Vote               │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │ Automatic Vote     │
                    │ Counting            │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │ 🏆 Round Winner    │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │ Next Round        │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │ 🥇 Final Leaderboard│
                    └────────────────────┘
```

---

# 👥 User Roles

## 👤 Participant

Participants are the actual competitors and voters.

They can:

* Scan the competition QR code
* Join the competition
* Enter their name/team name
* Wait for the round to begin
* View the challenge image
* Submit their prompt
* View other participants' submissions
* Vote for their preferred submission
* View the round winner
* View the overall leaderboard

### Important

Participants **cannot vote for their own submission**.

The voting system should prevent duplicate voting within a round.

---

## 👨‍💼 Admin / Club Lead

Admins control the competition but **do not select the winner**.

They can:

* Create a competition
* Generate/display the QR code
* Start a round
* Select or randomize the challenge image
* Monitor participants
* Monitor submissions
* Open/close voting
* End a round
* Cancel a round
* Start the next round
* End the competition
* Display the leaderboard

### Admins do NOT:

* Choose the round winner
* Manually assign scores
* Override participant votes

The winner is determined automatically by the voting system.

---

## 🖥️ Live Display

A dedicated display can be connected to a projector, TV, or large screen.

It can show:

* Competition name
* QR code
* Participant count
* Current round
* Challenge image
* Countdown timer
* Submission status
* Voting status
* Round winner
* Current leaderboard
* Final leaderboard

---

# 🔄 Round Flow

Each round follows this process:

```text
WAITING
   ↓
ROUND STARTED
   ↓
CHALLENGE SHOWN
   ↓
PROMPT SUBMISSION
   ↓
SUBMISSIONS CLOSED
   ↓
VOTING
   ↓
VOTING CLOSED
   ↓
VOTE COUNTING
   ↓
ROUND WINNER
   ↓
LEADERBOARD UPDATE
   ↓
NEXT ROUND
```

The Admin controls when each stage starts and ends.

---

# 🗳️ Voting System

The most important part of the competition is **peer voting**.

After everyone submits their prompt, the submissions are displayed to participants.

Example:

```text
┌──────────────────────────────┐
│       ROUND 3 SUBMISSIONS    │
├──────────────────────────────┤
│                              │
│  Team Alpha                  │
│  "A futuristic city..."     │
│                              │
│           [ VOTE ]           │
│                              │
├──────────────────────────────┤
│                              │
│  Team Nova                   │
│  "A cyberpunk metropolis..." │
│                              │
│           [ VOTE ]           │
│                              │
└──────────────────────────────┘
```

Participants choose the submission they like the most.

### Voting Rules

* Each participant gets **one vote per round**
* A participant cannot vote for themselves
* A participant cannot vote multiple times
* Votes are counted automatically
* The submission with the highest number of votes wins

---

# 🏆 Round Winner

Example:

| Team        | Votes |
| ----------- | ----: |
| Team Alpha  |    12 |
| Team Nova   |    18 |
| Team Vision |     9 |
| Team X      |    14 |

The system automatically declares:

```text
🏆 ROUND WINNER

TEAM NOVA

18 Votes
```

No admin decision is required.

---

# 📊 Leaderboard

Each round contributes to the overall competition score.

For example:

```text
Round 1 → 15 votes
Round 2 → 21 votes
Round 3 → 18 votes
```

Total:

```text
Total Score = 15 + 21 + 18
            = 54
```

The leaderboard can display:

| Rank | Team        | Total Votes |
| ---- | ----------- | ----------: |
| 🥇 1 | Team Nova   |          54 |
| 🥈 2 | Team Alpha  |          49 |
| 🥉 3 | Team Vision |          43 |
| 4    | Team X      |          38 |

---

# 🔢 Dynamic Number of Rounds

The competition does **not** have a fixed number of rounds.

The organizer can run:

* 5 rounds
* 10 rounds
* 20 rounds
* Any number of rounds

For example:

```text
Round 1
   ↓
Round 2
   ↓
Round 3
   ↓
Round 4
   ↓
Round 5
   ↓
ADMIN ENDS COMPETITION
   ↓
FINAL LEADERBOARD
```

The Admin can end the competition whenever they want.

---

# 🛑 Admin Controls

The Admin Dashboard should provide controls such as:

```text
┌─────────────────────────────┐
│       ADMIN DASHBOARD       │
├─────────────────────────────┤
│                             │
│  Participants: 24           │
│  Current Round: 5            │
│                             │
│  [ START ROUND ]             │
│                             │
│  [ CLOSE SUBMISSIONS ]       │
│                             │
│  [ START VOTING ]            │
│                             │
│  [ END VOTING ]              │
│                             │
│  [ SHOW WINNER ]             │
│                             │
│  [ NEXT ROUND ]              │
│                             │
│  [ END COMPETITION ]         │
│                             │
│  [ CANCEL ROUND ]             │
│                             │
└─────────────────────────────┘
```

This gives the organizer complete control over the event timing.

---

# 🖥️ Three Main Interfaces

The system can be divided into three interfaces.

### 1. Participant Interface

```text
QR Scan
   ↓
Join Competition
   ↓
Challenge
   ↓
Submit Prompt
   ↓
Vote
   ↓
View Result
```

### 2. Admin Interface

```text
Create Competition
   ↓
Manage Participants
   ↓
Start/Stop Rounds
   ↓
Manage Voting
   ↓
End Competition
```

### 3. Live Display

```text
QR Code
   ↓
Challenge
   ↓
Timer
   ↓
Voting
   ↓
Winner
   ↓
Leaderboard
```

---

# 🏗️ System Architecture

```text
                       ┌───────────────────┐
                       │      Backend      │
                       │                   │
                       │ Competition       │
                       │ Participants      │
                       │ Rounds            │
                       │ Prompts           │
                       │ Votes             │
                       │ Scores            │
                       └─────────┬─────────┘
                                 │
             ┌───────────────────┼───────────────────┐
             │                   │                   │
             ▼                   ▼                   ▼
      ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
      │ Participant │     │    Admin    │     │   Display   │
      │   Website   │     │  Dashboard  │     │    Screen   │
      └─────────────┘     └─────────────┘     └─────────────┘
```

---

# 📂 Suggested Project Structure

```text
project/
│
├── participant/
│   ├── join/
│   ├── challenge/
│   ├── submission/
│   ├── voting/
│   └── results/
│
├── admin/
│   ├── dashboard/
│   ├── participants/
│   ├── rounds/
│   ├── submissions/
│   ├── voting/
│   └── leaderboard/
│
├── display/
│   ├── qr/
│   ├── challenge/
│   ├── voting/
│   ├── results/
│   └── leaderboard/
│
├── backend/
│   ├── authentication/
│   ├── competitions/
│   ├── rounds/
│   ├── participants/
│   ├── submissions/
│   ├── votes/
│   └── scoring/
│
└── README.md
```

---

# ✨ Key Features

* 📱 QR-based joining
* 👥 Multiple participants
* 👨‍💼 Admin-controlled competition
* 🖼️ Random visual challenges
* ✍️ AI prompt submission
* 🗳️ Participant-based voting
* 🚫 No self-voting
* 🔒 One vote per participant per round
* 🔄 Dynamic number of rounds
* ⏱️ Round timer
* 🏆 Automatic winner calculation
* 📊 Automatic leaderboard
* 📺 Live event display
* 🛑 Admin-controlled round ending
* ❌ Round/competition cancellation
* 🔐 Role-based access

---

# 💡 Example Event

Suppose a college AI club organizes a competition with **30 participants**.

### Round 1

A random banner is displayed:

> Create a prompt that can generate an image similar to this banner.

All participants submit their prompts.

Once submissions close, the entries are shown.

Participants vote.

The system calculates:

```text
Team Alpha → 8 votes
Team Nova  → 15 votes
Team X     → 7 votes
```

Therefore:

```text
🏆 TEAM NOVA WINS ROUND 1
```

The result is added to the leaderboard.

---

### Round 2

A new challenge is displayed.

Participants submit new prompts and vote again.

The process continues until the Admin ends the competition.

---

# 🧠 Core Concept

The platform combines:

**AI + Prompt Engineering + Creativity + Peer Voting + Competition + Real-Time Interaction**

Instead of having a single judge decide which prompt is best, the platform allows the **participants themselves to decide the winner**.

This makes the experience more interactive, competitive, and engaging.

---

# 🔮 Future Improvements

Possible future features include:

* 🤖 AI-generated challenge images
* 🎨 Automatic image generation from submitted prompts
* 🧠 AI-based prompt analysis
* 📈 Detailed competition analytics
* 🎖️ Achievements and badges
* 🔥 Live voting animations
* 🏅 Certificates
* 🎨 Custom event themes
* 📱 Mobile-optimized participant experience
* 🌐 Multiple simultaneous competitions
* 📺 Advanced presentation mode
* 🔐 Enhanced anti-cheating and vote validation

---

# 🛠️ Possible Technology Stack

The final technology stack can be adapted according to implementation requirements.

Possible technologies:

* **Frontend:** Flutter / Flutter Web
* **Backend:** Firebase
* **Authentication:** Firebase Authentication
* **Database:** Cloud Firestore
* **Storage:** Firebase Storage
* **QR:** QR generation and scanning libraries
* **Hosting:** Firebase Hosting

---

# 🎯 Project Goal

The goal of **AI Prompt Battle** is to transform prompt engineering into a **live, interactive competition**.

Participants don't just write prompts — they:

**Observe → Create → Submit → Vote → Compete → Win**

The platform handles the complete competition lifecycle, from QR-based joining to the final leaderboard.
