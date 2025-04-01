# Gate Controller Cloud v3

A Next.js-based web application for controlling and monitoring gates.

## Features

- Modern Next.js 15 application with App Router
- TypeScript for type safety
- SQLite database for data persistence
- Redis for job queue management
- BullMQ for background job processing
- TailwindCSS for styling
- Docker containerization for deployment

## Prerequisites

- Node.js 22.11.0 or later
- npm or yarn package manager
- Docker (for containerized deployment)
- Fly.io CLI (for deployment)

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm ci
   ```

3. Set up environment variables:
   Create a `.env` file with the following variables:
   ```
   INITIAL_ADMIN_CREDENTIALS=your_INITIAL_ADMIN_CREDENTIALS
   ```

4. Start the development server:
   ```bash
   PORT=3001 REDISMS_PORT=6379 npm run dev:all
   ```

The application will be available at [http://localhost:3001](http://localhost:3001).

## Development

- `npm run dev` - Start the development server with Turbopack
- `npm run dev:redis` - Start Redis memory server
- `npm run dev:all` - Start both Next.js and Redis servers concurrently
- `npm run build` - Build the application for production
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint for code linting

## Deployment

The application is configured for deployment on Fly.io using Docker. The deployment process is handled through the `fly.toml` configuration file.

   ```bash
   fly deploy
   ```

## Project Structure

```
cloud-v3/
├── src/
│   ├── app/          # Next.js app router pages
│   ├── components/   # React components
│   ├── hooks/        # Custom React hooks
│   ├── lib/          # Utility functions and shared code
│   ├── types/        # TypeScript type definitions
│   └── config.ts     # Application configuration
├── public/           # Static assets
└── data/             # Data storage directory (for development)
```

## Environment Variables

Environment variables can override settings and secrets in the `config.ts` file.

## License

Private - All rights reserved
