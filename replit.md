# LoomPad: Interactive Story Tree Explorer

## Overview
LoomPad is an interactive Progressive Web App (PWA) for exploring branching narratives with AI-powered text generation. It features a gamepad-style interface with keyboard controls for navigating story trees and generating AI continuations.

**Tech Stack:**
- Runtime: Bun 1.2.16
- Frontend: React + Vite + TypeScript
- Backend: Express.js with Server-Side Rendering (SSR)
- AI: OpenRouter API for text generation
- Styling: Styled Components
- Storage: Local Storage for persistence

## Recent Changes (Import Setup)
- October 4, 2025: Imported from GitHub and configured for Replit environment
  - Installed Bun runtime and dependencies
  - Configured Vite dev server to work with Replit's proxy (port 5000, host 0.0.0.0)
  - Fixed TypeScript configuration by adding @types/node
  - Installed @rollup/rollup-linux-x64-gnu to resolve build issues
  - Set up deployment configuration (autoscale)
  - Server binds to 0.0.0.0:5000 for frontend access

## Project Structure
```
├── client/           # Frontend React application
│   ├── interface/    # UI components, hooks, menus
│   ├── assets/       # PWA icons and screenshots
│   └── styles/       # CSS styles
├── server/           # Backend Express server with SSR
│   └── apis/         # HTTP endpoints and generation API
├── shared/           # Common types and utilities
├── config/           # TypeScript and Vite configuration
└── run.ts            # Entry point
```

## Environment Variables
- `OPENROUTER_API_KEY` (optional): API key for OpenRouter text generation
  - If not set, uses a placeholder key for development
  - Required for production deployment

## Development
- **Start dev server**: `bun run dev` (uses nodemon with hot reload)
- **Port**: 5000 (configured for Replit)
- **Dev mode**: SSR enabled, HMR via WebSocket (wss protocol for Replit)

## Building & Deployment
- **Build**: `bun run build` - Creates production bundles in `dist/`
- **Production**: `bun run prod` - Runs optimized production server
- **Deployment**: Configured for Replit Autoscale deployment

## Key Features
- Gamepad-style interface with keyboard controls
- Multiple story trees with branching narratives
- AI-powered text generation via OpenRouter
- Automatic local storage persistence
- Progressive Web App (installable, works offline)
- Server-side rendering for better performance

## Controls
- Arrow Keys/D-Pad: Navigate story tree
- Enter/A: Generate new continuation
- Backspace/B: Edit current text
- ~/Select: Open settings
- Escape/Start: Switch between stories

## User Preferences
None configured yet.

## Project Architecture
- **Frontend-Backend Split**: Express serves both API routes and SSR'd React
- **Vite Integration**: Custom Vite server middleware for development HMR
- **API Routes**: `/api/generate`, `/api/models`, `/api/props`
- **SSR**: Renders React on server for initial page load
- **PWA**: Service worker caching with VitePWA plugin
