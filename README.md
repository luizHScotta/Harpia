*HARP-I.A — Socio-environmental intelligence platform for low-lying urban areas*

Developed for the NASA International Space Apps Challenge.
(Optional) Add the logo to your repo and reference it here:
![NASA International Space Apps Challenge]

Summary
Low-lying urban areas (historically occupied, lower-elevation zones) concentrate hydrogeological risks, flooding, urban heat islands, and low tree cover. In cities like Belém (PA), a large share of residents live in these territories—a geography of risk increasingly stressed by climate change.
Just as harp.ia watches over the Amazon forest, we realized satellite data can reveal hidden signals of these events. There is an abundance of data (NASA, Copernicus, etc.) and AI capable of translating sources such as SAR, MODIS, Copernicus, and IBGE into accessible insights about floods, climate, and socio-environmental risk.
The platform supports natural-language queries, report generation, and SAR image visualization, turning complex knowledge into practical, accessible information for those who need it most.

Who we are — Harp.ia Team

We are Harp.ia, a multidisciplinary team focused on data, environment, and Amazonian cities. Inspired by the sharp vision of the harpy eagle, we build solutions that “see” the territory and translate complex data into usable knowledge for communities, public managers, researchers, journalists, and civil society organizations.

Project (HARP-I.A)

HARP-I.A is an AI + Remote Sensing dashboard that integrates SAR imagery, flood maps, infrared bands, and tree-cover data to contextualize hydro-climatic risks and their social impacts.
The platform highlights the connection between geomorphology and social vulnerability: low-lying terrain is more prone to flooding, and peripheral populations typically have fewer resources and less information to prepare for or respond to these events. Although satellite data and historical records exist, they rarely reach those most exposed.

The problem

Residents of low-lying areas face floods, extreme heat, and other climate risks, but geospatial/meteorological data doesn’t arrive in an accessible way. Technologies like SAR, MODIS, and Copernicus generate insights about flooding, land-surface temperature, vegetation, and topography—yet they often remain in expert silos.

The data-to-action gap

Even with abundant information, user-friendly tools are missing to convert that data into local action. Vulnerable communities often lack technical training and access to platforms capable of interpreting satellite imagery, climate patterns, or historical events.

Our solution

HARP-I.A bridges this gap with a conversational interface and interactive map. A user can select an area or share a location and ask, for example:
“What’s the flood risk next week?”
The system combines real-time data, event history, and climate models to deliver clear answers, plus reports on flood risk, heat-island intensity, hydrogeological hazards, and socio-environmental indicators—supporting planning and response by communities, academia, and NGOs.

How it works

A map-based interface connected to the Microsoft Planetary Computer.

AI interprets natural-language queries and fuses multiple sources (SAR, MODIS, Copernicus, IBGE).

Provides real-time insights, historical analyses, and predictive indications of environmental hazards.

Enables satellite image exploration, custom searches, and fosters citizen science through gamification.

Use of Artificial Intelligence (AI)

Core feature: a conversational interface powered by LLMs so anyone can ask about flooding, climate change, and environmental risks, receiving plain-language explanations.

Tools used

ChatGPT (OpenAI GPT-4): interprets natural-language questions and translates GIS outputs into clear information.

Lovable: orchestrates the dashboard backend, integrating data sources and enabling near-real-time responses.

OpenAI — Text Review Tools: refine and enhance project texts and descriptions (prompts, reports, materials).

Real-time API & Function Calling: allow the AI agent to fetch up-to-date data, compose queries (e.g., SQL), and return immediate, concise answers.

Tech stack

Vite

TypeScript

React

shadcn-ui

Tailwind CSS

Getting started

Prerequisites: Node.js (LTS) and npm installed.

# Step 1: Clone the repository using your project URL.
git clone <YOUR_GIT_URL>

# Step 2: Enter the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install dependencies.
npm i

# Step 4: Start the dev server with hot reload and instant preview.
npm run dev
