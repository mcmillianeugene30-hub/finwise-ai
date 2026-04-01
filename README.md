# FinWise AI 💰

> A full-stack personal finance chatbot powered by OpenAI GPT-4. Track expenses, get AI-driven financial insights, and take control of your budget — all in one place.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-brightgreen)](https://mongodb.com)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4-purple)](https://openai.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## ✨ Features

- 🤖 **AI Financial Assistant** — Chat with GPT-4 for personalised budgeting advice, spending analysis, and savings tips
- 📊 **Expense Tracking** — Full CRUD: add, view, update, and delete expenses with categories and dates
- 🔐 **JWT Authentication** — Secure register/login flow with bcrypt password hashing
- 📈 **Dashboard Analytics** — Doughnut chart breakdown of spending by category plus monthly totals
- 🏷️ **Category Management** — Organise expenses across 12 categories (Food, Transport, Housing, etc.)
- 💬 **Context-Aware Chat** — AI uses your real expense history to give smarter, personalised advice
- 📱 **Responsive UI** — Fully responsive React 18 frontend styled with TailwindCSS

---

## 🛠 Tech Stack

| Layer      | Technology                                    |
|------------|-----------------------------------------------|
| Frontend   | React 18, React Router v6, Axios, TailwindCSS |
| Charts     | Chart.js 4 + react-chartjs-2                  |
| Backend    | Node.js 18+, Express.js 4                     |
| Database   | MongoDB with Mongoose ODM                     |
| AI Engine  | OpenAI GPT-4o API (`openai` SDK v4)           |
| Auth       | JSON Web Tokens (JWT) + bcryptjs (12 rounds)  |
| Security   | Helmet, CORS, express-rate-limit              |
| Dev Tools  | Nodemon, Concurrently, Morgan                 |

---

## 📁 Project Structure

```
finwise-ai/
├── client/                        # React 18 frontend
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat.jsx           # AI chat interface with message history
│   │   │   ├── Dashboard.jsx      # Expense dashboard with analytics + CRUD
│   │   │   └── Login.jsx          # Registration & login form (tabbed)
│   │   └── App.jsx                # Root app: AuthContext, Router, Navbar
│   └── package.json               # React app dependencies
├── server/                        # Express.js backend
│   ├── middleware/
│   │   └── auth.js                # JWT verification middleware
│   ├── models/
│   │   ├── User.js                # Mongoose User schema/model
│   │   └── Expense.js             # Mongoose Expense schema/model + indexes
│   ├── routes/
│   │   ├── auth.js                # POST /register, POST /login, GET /me
│   │   ├── chat.js                # POST /chat (OpenAI + expense context)
│   │   └── expenses.js            # GET/POST/PUT/DELETE + GET /summary
│   └── index.js                   # Server entry: middleware, routes, error handler
├── .env.example                   # Environment variable template
├── package.json                   # Root scripts & server dependencies
└── README.md
```

---

## ⚙️ Prerequisites

- **Node.js** >= 18.x → [Download](https://nodejs.org)
- **MongoDB** — local install OR free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster
- **OpenAI API Key** → [Get one here](https://platform.openai.com/api-keys)

---

## 🚀 Setup & Installation

### 1. Clone the Repository

```bash
git clone https://github.com/mcmillianeugene30-hub/finwise-ai.git
cd finwise-ai
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```env
MONGO_URI=mongodb://localhost:27017/finwise
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=7d
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:3000
```

> 💡 Generate a strong JWT secret:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

### 3. Install All Dependencies

```bash
# Option A — convenience script
npm run install-all

# Option B — manual
npm install
npm install --prefix client
```

### 4. Run in Development Mode

```bash
# Starts Express on :5000 and React dev server on :3000 concurrently
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Build & Run for Production

```bash
npm run build   # Builds React client → client/build/
npm start       # Serves API + static build from Express on :5000
```

---

## 🔌 API Reference

### Auth  `POST /api/auth/*`

| Method | Route             | Body                          | Response          |
|--------|-------------------|-------------------------------|-------------------|
| POST   | `/register`       | `{ name, email, password }`   | `{ token, user }` |
| POST   | `/login`          | `{ email, password }`         | `{ token, user }` |
| GET    | `/me`             | — *(auth required)*           | `{ user }`        |

### Expenses  `/api/expenses/*`  *(all require `Authorization: Bearer <token>`)*

| Method | Route         | Body / Query                                    | Description            |
|--------|---------------|-------------------------------------------------|------------------------|
| GET    | `/`           | `?category=&startDate=&endDate=&page=&limit=`   | Paginated expense list |
| GET    | `/summary`    | `?startDate=&endDate=`                          | Category totals        |
| POST   | `/`           | `{ title, amount, category, date?, note? }`     | Create expense         |
| PUT    | `/:id`        | Any expense fields                              | Update expense         |
| DELETE | `/:id`        | —                                               | Delete expense         |

### Chat  `POST /api/chat`  *(auth required)*

| Method | Route | Body                                       | Response                  |
|--------|-------|--------------------------------------------|---------------------------|
| POST   | `/`   | `{ message, conversationHistory?: [...] }` | `{ reply, usage, model }` |

---

## 🔒 Security Highlights

| Concern          | Implementation                                               |
|------------------|--------------------------------------------------------------|
| Password storage | bcryptjs with **12 salt rounds**                             |
| Auth tokens      | JWT signed with `JWT_SECRET`, 7-day expiry                   |
| Route protection | Middleware verifies token + checks user still exists in DB   |
| Input validation | `express-validator` on all POST/PUT routes                   |
| Rate limiting    | Global: 100 req/15 min · Chat: 20 req/min                    |
| HTTP headers     | `helmet` sets CSP, HSTS, X-Frame-Options, etc.               |
| CORS             | Restricted to `CLIENT_ORIGIN` in production                  |
| Payload size     | Body parser rejects requests > 10 KB                         |

---

## 🗺 Roadmap

- [ ] Recurring expense support
- [ ] Budget targets per category with alerts
- [ ] CSV / PDF export
- [ ] Monthly email summaries
- [ ] OAuth (Google) login
- [ ] Mobile app (React Native)

---

## 🤝 Contributing

1. Fork the repo
2. Create your feature branch: `git checkout -b feature/your-feature`
3. Commit: `git commit -m 'feat: add your feature'`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

MIT © 2024 FinWise AI — see [LICENSE](LICENSE) for details.
