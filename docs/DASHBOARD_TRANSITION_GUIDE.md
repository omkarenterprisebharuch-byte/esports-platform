# Dashboard-Centric Architecture Implementation Guide

## Overview

This document outlines the implementation of a dashboard-centric user interface for the esports platform, transitioning from a login-first experience to a public-facing landing page with protected dashboard features.

---

## Architecture Summary

### Three-Tier Page Access Model

| Tier | Access Level | Pages |
|------|--------------|-------|
| **Public** | Anyone can access | `/home`, `/tournaments`, `/tournaments/[id]`, `/leaderboard`, `/hall-of-fame` |
| **Auth** | Only unauthenticated users | `/login`, `/register`, `/forgot-password` |
| **Protected** | Authenticated users only | `/dashboard`, `/profile`, `/my-teams`, `/my-registrations`, `/wallet`, `/register-tournament/[id]`, `/admin` |

### Route Groups Structure

```
src/app/
├── page.tsx                      # Smart router (redirects based on auth state)
├── (public)/                     # Public pages with shared header/footer
│   ├── layout.tsx               # Public navigation layout
│   ├── home/page.tsx            # Landing page
│   ├── tournaments/
│   │   ├── page.tsx             # Tournament browsing
│   │   └── [id]/page.tsx        # Tournament details
│   └── ...
├── (auth)/                       # Authentication pages
│   ├── login/page.tsx           # Enhanced with redirect support
│   ├── register/page.tsx        # Enhanced with redirect support
│   └── ...
└── (dashboard)/                  # Protected dashboard pages
    ├── layout.tsx               # Dashboard sidebar layout
    ├── dashboard/page.tsx       # Main dashboard
    └── ...
```

---

## User Flow Diagrams

### Guest User Journey

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Guest visits website (/)                                    │
│     ↓                                                           │
│  2. Redirected to /home (landing page)                         │
│     ↓                                                           │
│  3. Browses tournaments at /tournaments                         │
│     ↓                                                           │
│  4. Views tournament details at /tournaments/[id]               │
│     ↓                                                           │
│  5. Clicks "Register for Tournament"                            │
│     ↓                                                           │
│  6. Redirected to /login?redirect=/register-tournament/[id]     │
│     ↓                                                           │
│  7. Logs in or creates account                                  │
│     ↓                                                           │
│  8. Automatically redirected to /register-tournament/[id]       │
│     ↓                                                           │
│  9. Completes tournament registration                           │
└─────────────────────────────────────────────────────────────────┘
```

### Authenticated User Journey

```
┌─────────────────────────────────────────────────────────────────┐
│  1. User visits website (/)                                     │
│     ↓                                                           │
│  2. Automatically redirected to /dashboard                      │
│     ↓                                                           │
│  3. Sees personalized tournament recommendations                │
│     ↓                                                           │
│  4. Can navigate to any protected page via sidebar              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Implementation Details

### 1. Root Page Router (`src/app/page.tsx`)

```typescript
// Redirects authenticated users to dashboard
// Redirects guests to public landing page
if (token) {
  redirect("/app");
}
redirect("/home");
```

### 2. Middleware Authentication (`src/middleware.ts`)

The middleware handles:
- **Public paths**: Accessible without authentication
- **Protected paths**: Redirect to login with return URL
- **Auth paths**: Redirect logged-in users to dashboard

Key features:
- Preserves original destination URL during auth flow
- Adds context for better UX messaging (e.g., "Please sign in to register")
- Validates redirect URLs to prevent open redirect attacks

### 3. Login Page with Redirect Support

```typescript
// Get redirect URL from query params
const redirectTo = searchParams.get("redirect") || "/dashboard";

// After successful login
const safeRedirect = redirectTo.startsWith("/") ? redirectTo : "/dashboard";
router.push(safeRedirect);
```

### 4. Public Tournament Pages

- **Browsing** (`/tournaments`): Full filtering, search, game selection
- **Details** (`/tournaments/[id]`): Complete tournament info with CTA
- **Registration CTA**: Redirects guests to login with proper return URL

---

## Navigation Patterns

### Public Header (for guests)
- Logo + Platform name
- Navigation: Tournaments, Leaderboard, Hall of Fame
- Auth buttons: Sign In, Get Started

### Dashboard Sidebar (for authenticated users)
- User profile preview
- Navigation menu:
  - 🏠 Dashboard
  - 👤 Profile
  - 🏆 Hall of Fame
  - 👥 My Teams
  - 👥 My Registrations
  - 💰 Wallet
- Admin Panel (for hosts/admins)
- Owner Portal (for owners)
- Logout button

---

## Dashboard Layout Features

### Priority 1: Above the Fold
1. **Personalized Recommendations**: AI-suggested tournaments based on game preferences
2. **Active Registrations**: Quick access to upcoming matches with check-in status
3. **Wallet Balance**: Current balance with quick add-funds action

### Priority 2: Main Content
1. **All Tournaments**: Filterable list with status indicators
2. **Quick Filters**: All, Registered, Live, Upcoming, Ongoing
3. **Advanced Filters**: Game type, prize range, date range, sorting

### Priority 3: Supporting Content
1. **Recent Activity**: Match history and results
2. **Team Status**: Team invites and member updates
3. **Notifications**: Important platform updates

---

## Security Considerations

### Authentication
- JWT tokens stored in httpOnly cookies (not localStorage)
- CSRF protection for mutation requests
- Automatic token refresh on 401 responses
- 30-minute idle timeout with warning

### Authorization
- Role-based access: player, host, admin, owner
- Resource ownership verification
- Rate limiting on sensitive endpoints

### Redirect Security
```typescript
// Always validate redirect URLs
const safeRedirect = redirectTo.startsWith("/") ? redirectTo : "/dashboard";
```

---

## Error Handling

Reference error codes in `docs/ERROR_CODES.txt`:

| Code | Scenario | User Message |
|------|----------|--------------|
| AUTH_1001 | Not logged in | "Please log in to continue" |
| AUTH_1002 | Session expired | "Your session has expired" |
| REG_4001 | Already registered | "You are already registered" |
| REG_4008 | Insufficient funds | "Insufficient wallet balance" |

---

## Testing Checklist

### Guest User Flows
- [ ] Landing page loads without authentication
- [ ] Can browse tournaments publicly
- [ ] Can view tournament details
- [ ] Clicking "Register" redirects to login
- [ ] After login, returns to tournament registration
- [ ] New registration completes successfully

### Authenticated User Flows
- [ ] Visiting `/` redirects to `/dashboard`
- [ ] Dashboard shows personalized content
- [ ] Navigation sidebar works correctly
- [ ] Can register for tournaments directly
- [ ] Session timeout warning appears
- [ ] Logout clears all state

### Edge Cases
- [ ] Invalid redirect URLs are sanitized
- [ ] Expired sessions redirect properly
- [ ] Rate limiting messages display correctly
- [ ] Mobile responsive design works

---

## File Changes Summary

### New Files Created
1. `src/app/(public)/layout.tsx` - Public header/footer layout
2. `src/app/(public)/home/page.tsx` - Landing page
3. `src/app/(public)/page.tsx` - Alternate landing page
4. `src/app/(public)/tournaments/page.tsx` - Public tournament browsing
5. `src/app/(public)/tournaments/[id]/page.tsx` - Public tournament details

### Modified Files
1. `src/app/page.tsx` - Smart router for auth state
2. `src/middleware.ts` - Enhanced redirect handling
3. `src/app/(auth)/login/page.tsx` - Redirect support + dark mode
4. `src/app/(auth)/register/page.tsx` - Redirect support + dark mode

---

## Next Steps

1. **Move existing leaderboard**: Consider moving `/leaderboard` to `(public)` route group
2. **Add loading states**: Implement skeleton loaders for public pages
3. **SEO optimization**: Add metadata for public pages
4. **Analytics**: Track conversion from public to registered users
5. **A/B testing**: Test different CTA placements on landing page
