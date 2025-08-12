# Overview

This is a St. Regis Osaka Valet Management System - a full-stack web application built for managing hotel valet parking services. The system provides a customer-facing interface for ticket submission and status tracking with timed progression stages, along with staff and admin dashboards for operations management. It features real-time countdown timers (5 min → 5 min → 3 min), WebSocket connections, OCR-based ticket scanning, and role-based access control.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: Radix UI primitives with shadcn/ui components for consistent design
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Real-time Communication**: Custom WebSocket hook for live updates

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: Replit Auth with OpenID Connect integration
- **Session Management**: Express sessions with PostgreSQL storage
- **Real-time Updates**: WebSocket server for live ticket status updates

## Database Design
- **Primary Database**: PostgreSQL with Neon serverless hosting
- **Schema Management**: Drizzle with migration support
- **Key Tables**:
  - Users (Replit Auth integration)
  - Valet Tickets (core business logic)
  - FAQs (customer support)
  - System Settings (configuration)
  - Sessions (authentication state)

## Authentication & Authorization
- **Provider**: Replit Auth with OpenID Connect
- **Session Storage**: PostgreSQL-backed sessions with connect-pg-simple
- **Role-based Access**: Two roles (standard, superadmin) with route protection
- **Security**: HTTP-only cookies, secure session handling

## API Architecture
- **Style**: RESTful API with Express routes
- **Validation**: Zod schemas for request/response validation
- **Error Handling**: Centralized error middleware with proper HTTP status codes
- **Middleware**: Authentication checks, request logging, JSON parsing

## Real-time Features
- **WebSocket Server**: Custom WebSocket implementation for live updates
- **Event Types**: Ticket creation, status updates, system notifications
- **Client Integration**: React hook for WebSocket connection management
- **Countdown Timers**: Live MM:SS countdown for each stage (5min → 5min → 3min)
- **Automatic Progression**: Stages advance automatically when timers expire
- **Fallback**: Polling mechanism as backup for real-time updates

## File Structure
- `/client` - React frontend application
- `/server` - Express backend with API routes
- `/shared` - Common schemas and types between frontend and backend
- Database configuration and migrations at root level

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Environment**: Requires DATABASE_URL for connection string

## Authentication
- **Replit Auth**: OpenID Connect provider for user authentication
- **Required Environment Variables**: REPL_ID, SESSION_SECRET, ISSUER_URL, REPLIT_DOMAINS

## Frontend Libraries
- **Radix UI**: Comprehensive set of accessible UI primitives
- **Framer Motion**: Animation library for smooth UI transitions
- **Tesseract.js**: OCR library for ticket number scanning from camera
- **Date-fns**: Date manipulation and formatting utilities

## Development Tools
- **Vite**: Frontend build tool with HMR and development server
- **TypeScript**: Type safety across the entire stack
- **Tailwind CSS**: Utility-first CSS framework
- **ESBuild**: Fast JavaScript bundler for production builds

## Session & Storage
- **connect-pg-simple**: PostgreSQL session store for Express sessions
- **Memoizee**: Function memoization for performance optimization

## Development Environment
- **Replit Integration**: Custom plugins for development experience
- **WebSocket Support**: Native WebSocket implementation for real-time features
- **Environment Detection**: Development vs production configuration handling