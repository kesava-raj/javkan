# Javkan.Ai – Voice AI Recruiting Demo

Vite (vanilla JS) front end with a custom UI. The voice brain is your Vapi assistant.
Click "Speak With Javkan" and the browser starts a live Vapi call. The orb reacts to the assistant's voice and the transcript appears in the chat panel.

## Run it

```bash
npm install
cp .env.example .env     # then fill in the two values below
npm run dev              # http://localhost:5173
```

Requires Node 18 or newer. Use `localhost` or https so the browser allows microphone access.

## Connect Vapi

Put these in `.env` (never commit it):

```
VITE_VAPI_PUBLIC_KEY=your-vapi-PUBLIC-key
VITE_VAPI_ASSISTANT_ID=your-assistant-id
```

- Use the **public** key only. The private key must never go in front-end code.
- Without both values, the page falls back to the scripted demo.
- Restart `npm run dev` after editing `.env`.

## Suggested assistant setup (Vapi dashboard)

First message:
> Hi, I’m Javkan, your recruiting assistant. I’ll ask a few quick questions and you can ask me anything about the role. May I have your name?

System prompt:
> You are Javkan, a friendly voice recruiting assistant for [Company]. Keep replies short and conversational. Start by collecting the candidate’s name, email, current role, years of experience, notice period and expected salary, one question at a time. Then answer questions about the open roles using only the information below. If you don’t know, say you’ll pass the question to the recruiting team. Never invent salaries, benefits or policies.
>
> Open roles: [paste your job descriptions, benefits and hiring process here]

To let Javkan look up live data or save candidate details, add a tool or server URL to the assistant in Vapi.

## Structure

- `index.html` – page markup
- `src/style.css` – styling (colors are variables in `:root`)
- `src/main.js` – orb animation, Vapi call handling, scripted fallback demo

## Deploy

`npm run build` creates `dist/`. Host it on Vercel or Netlify and add the same two variables in the project’s environment settings.
