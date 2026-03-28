# FleetPulse API

REST API for Fleet & Driver Management System.

![CI](https://github.com/hariom-kr-cjd/fleetpulse-api/actions/workflows/ci.yml/badge.svg)

## Tech Stack
- **Runtime:** Node.js 18+ / TypeScript
- **Framework:** Express.js
- **Database:** MongoDB 7 / Mongoose
- **Auth:** JWT + RBAC (admin, fleet_manager, driver)
- **Testing:** Jest + Supertest + mongodb-memory-server

## Features
- User management with role-based access control
- Vehicle fleet management (CRUD, location tracking, maintenance history)
- Trip lifecycle management (create, assign, start, checkpoint, complete, cancel)
- Dashboard KPIs and fleet map data
- Analytics (trips by status, vehicle utilization, driver performance)
- Audit logging for all admin actions
- Notification integration with Kotlin microservice
- Rate limiting, pagination, search/filter on all list endpoints

## API Endpoints

| Resource | Endpoints |
|----------|-----------|
| Auth | POST /register, /login, /refresh, /logout |
| Users | GET/PUT /me, GET/PUT/DELETE /users, /users/:id |
| Vehicles | GET/POST/PUT/PATCH /vehicles, location update, maintenance |
| Trips | GET/POST/PATCH /trips, start, checkpoint, complete, cancel |
| Drivers | GET /available, /me/trips, PATCH /availability |
| Dashboard | GET /stats, /fleet-map |
| Analytics | GET /trips, /vehicles, /drivers |
| Audit Logs | GET /audit-logs |

## Getting Started

```bash
# Install dependencies
npm install

# Create .env (copy from .env.example)
cp .env.example .env

# Run in development
npm run dev

# Run tests
npm test

# Seed demo data
npm run seed
```

## Demo Credentials (after seeding)
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@fleetpulse.com | Admin123! |
| Fleet Manager | manager1@fleetpulse.com | Manager123! |
| Driver | driver1@fleetpulse.com | Driver123! |

## Related Repos
- [fleetpulse-ui](https://github.com/hariom-kr-cjd/fleetpulse-ui) — Angular 15 frontend
- [fleetpulse-notifications](https://github.com/hariom-kr-cjd/fleetpulse-notifications) — Kotlin/Ktor notification service
- [fleetpulse-infra](https://github.com/hariom-kr-cjd/fleetpulse-infra) — Docker orchestration
