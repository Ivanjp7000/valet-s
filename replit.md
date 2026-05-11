# Overview

This is a St. Regis Osaka Valet Management System - a multi-tenant SaaS valet platform that digitalizes paper ticket systems. Supports multiple client companies (Organizational Units/OUs like Sony, Marriott, Panasonic) with multiple physical locations. Features hierarchical 3-tier role system (Super Admin, Privilege Admin, Standard Admin) with role-based access control and OU/location scoping, plus passwordless customer access via 5-digit tickets for self-service vehicle retrieval with live progress tracking.

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
  - organizational_units: Client companies (Sony, Marriott, etc.)
  - physical_locations: Valet locations within each OU
  - users: Staff accounts with role and OU/location assignments
  - user_location_scopes: Location restrictions for Standard Admins
  - valet_tickets: Core ticket data with ouId for OU-level scoping
  - FAQs (customer support)
  - System Settings (configuration)
  - Sessions (authentication state)

## Authentication & Authorization
- **Provider**: Replit Auth with OpenID Connect + Local auth (username/password)
- **Session Storage**: PostgreSQL-backed sessions with connect-pg-simple
- **Security**: HTTP-only cookies, secure session handling, bcrypt password hashing

## Hierarchical Access Control (3-Tier Role System)
- **Super Admin**: Full system access across all OUs and locations
  - Can manage OUs, all locations, all users, all tickets
  - Can assign any role to users
  - Sees global data
- **Privilege Admin**: OU-scoped access
  - Assigned to one OU
  - Can manage locations within their OU
  - Can create/manage Standard Admins within their OU
  - Can assign location scopes to restrict Standard Admins
  - Sees only data within their OU
- **Standard Admin**: Location-scoped or OU-scoped access
  - Assigned to one OU
  - If location scopes assigned: sees only data from those locations
  - If no location scopes: sees all data within their OU
  - Can create tickets, update status, manage daily operations

## Data Scoping Implementation
- **user_location_scopes table**: Links Standard Admins to specific locations
- **ouId on valet_tickets**: Denormalized OU reference for efficient filtering
- **Scoped queries**: getScopedTickets, getScopedUsers, getScopedLocations filter data based on user role and assignments
- **API enforcement**: Routes validate access before returning scoped data

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
- **Tesseract.js**: OCR library for ticket number scanning from camera (digits only — not used for plates)
- **Date-fns**: Date manipulation and formatting utilities
- **pdf-lib**: Client-side PDF generation for thermal label printing

## License Plate OCR
- **Engine**: Google Cloud Vision API (server-side, `POST /api/ocr/plate`)
- **API Key**: `GOOGLE_VISION_API_KEY` secret (env var)
- **Flow**: Frontend crops/resizes plate photo → sends base64 JPEG to server → server calls Vision API with `ja`/`en` language hints → returns raw text → `extractJapanesePlate()` cleans result into `[kanji] [class] [hiragana] [serial]` format
- **Billing**: Required on Google Cloud project; first 1,000 scans/month free then ~$1.50/1,000

## Thermal Label Printing
- **Printer Model**: Phomemo M110s (Bluetooth thermal label printer)
- **Technology**: Client-side PDF generation using pdf-lib
- **Label size**: 50mm × 70mm
- **Implementation**: Generates PDF with exact page dimensions (50mm × 70mm) and opens in new tab for printing
- **Printing workflow per device**:
  - **iPhone/iPad**: PDF opens in Safari → tap Share → "Open in Phomemo" app → Print (Bluetooth to M110s)
  - **Android**: PDF opens → share to Phomemo app → Print (Bluetooth to M110s)
  - **Desktop/Mac**: PDF opens in new tab → Ctrl/Cmd+P → select Phomemo M110s → set paper to 50×70mm
- **Name label** (valet-ticket-wizard): Prints guest name + QR code + "Visit Valet-s.com" on 50×70mm label
- **Key considerations**: 
  - Uses MediaBox for printer compatibility
  - Cursor-based layout fills entire label from top to bottom
  - Footer positioned at fixed bottom margin
  - Requires printer paper size to match label dimensions (50×70mm)
  - M110s connects via Bluetooth 3.0 — pair via Phomemo app before printing

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