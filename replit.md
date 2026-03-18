# Workspace

## Overview

**Fits** — Virtual Wardrobe app. A mobile application (Expo React Native) where users can add clothing items to their virtual wardrobe, browse a shared feed of all users' items, like items, filter by category, and manage their personal wardrobe.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Mobile**: Expo / React Native (Expo Router)
- **Auth**: Replit Auth (OIDC / PKCE for mobile)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── mobile/             # Expo React Native app (Fits)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── replit-auth-web/    # Replit Auth browser helper
```

## Features

- Auth via Replit OIDC (PKCE flow for mobile)
- Feed of clothing items from all users (masonry 2-column grid)
- Filter by category (куртки, обувь, etc.)
- Add new items with name, category, description, photo URL
- Like/unlike items with animated heart button
- Personal profile with wardrobe stats
- Delete own items

## DB Schema

- `users` - from replit-auth (id, firstName, lastName, email, profileImageUrl)
- `sessions` - auth sessions
- `items` - wardrobe items (id, userId, name, category, description, photoUrl, createdAt)
- `likes` - item likes (userId, itemId, unique constraint)

## Color Scheme

- Primary: #7C6AFE (violet)
- Background: #FAFAFA (off-white)
- Text: #0A0A0A (near black)
- Surface: #FFFFFF

## Key API Endpoints

- `GET /api/items?category=&userId=` — feed with like data
- `POST /api/items` — create item (auth required)
- `DELETE /api/items/:id` — delete own item (auth required)
- `POST /api/items/:id/like` — toggle like (auth required)
- `GET /api/categories` — list categories
