# Admin & Owner Panel Architecture Migration

## 📌 Current State

```
src/app/
├── (auth)/                    # Auth pages (login, register, forgot-password)
├── (public)/                  # Public pages (tournaments list)
├── app/                       # Authenticated user area
│   ├── layout.tsx            # Main app layout (sidebar, auth check)
│   ├── page.tsx              # User dashboard
│   ├── admin/                # 🔴 CURRENT: Admin pages nested under /app
│   │   ├── page.tsx          # Admin dashboard
│   │   ├── bans/
│   │   ├── create-tournament/
│   │   ├── leagues/
│   │   ├── reports/
│   │   └── wallet/
│   ├── owner/                # 🔴 CURRENT: Owner pages nested under /app
│   │   ├── page.tsx          # Owner dashboard
│   │   ├── ads/
│   │   ├── deposits/
│   │   └── monitoring/
│   ├── profile/
│   ├── teams/
│   ├── tournaments/
│   ├── wallet/
│   └── ...
└── api/
    ├── admin/                # Admin API routes
    └── owner/                # Owner API routes
```

### Current URLs
- Admin: `/app/admin/*`
- Owner: `/app/owner/*`
- User: `/app/*`

### Problems
1. Admin and Owner panels are nested under user area
2. No clean URL separation
3. Access control is done in each page component
4. Shared layout between user/admin/owner

---

## 🎯 Target Architecture

```
src/app/
├── (auth)/                    # Auth pages (login, register, forgot-password)
│   └── layout.tsx            # Auth layout
├── (public)/                  # Public pages
│   └── layout.tsx            # Public layout
├── (user)/                    # 🆕 Regular user pages (route group)
│   ├── layout.tsx            # User layout with sidebar
│   ├── app/
│   │   ├── page.tsx          # User home
│   │   ├── profile/
│   │   ├── teams/
│   │   ├── tournaments/
│   │   ├── registrations/
│   │   └── wallet/
│   └── ...
├── admin/                     # 🆕 Admin panel (top-level route)
│   ├── layout.tsx            # Admin layout with admin sidebar
│   ├── page.tsx              # Admin dashboard
│   ├── bans/
│   ├── create-tournament/
│   ├── leagues/
│   ├── reports/
│   └── wallet/
├── owner/                     # 🆕 Owner panel (top-level route)
│   ├── layout.tsx            # Owner layout with owner sidebar
│   ├── page.tsx              # Owner dashboard
│   ├── ads/
│   ├── deposits/
│   ├── monitoring/
│   └── users/
└── api/                       # API routes (unchanged)
    ├── admin/
    └── owner/
```

### New URLs
- **Admin**: `/admin/*` (Organizers & Owners)
- **Owner**: `/owner/*` (Owners only)
- **User**: `/app/*` (All authenticated users)

---

## 🔐 Access Control Matrix

| Panel | URL | Allowed Roles | Middleware Check |
|-------|-----|---------------|------------------|
| User | `/app/*` | player, organizer, owner | `isAuthenticated()` |
| Admin | `/admin/*` | organizer, owner | `isOrganizer(role)` |
| Owner | `/owner/*` | owner | `isOwner(role)` |

---

## 📂 Folder Structure (Detailed)

### Admin Panel (`/admin`)
```
src/app/admin/
├── layout.tsx                 # Admin layout
├── page.tsx                   # Admin dashboard
├── bans/
│   └── page.tsx
├── create-tournament/
│   └── page.tsx
├── leagues/
│   └── page.tsx
├── reports/
│   └── page.tsx
└── wallet/
    └── page.tsx
```

### Owner Panel (`/owner`)
```
src/app/owner/
├── layout.tsx                 # Owner layout
├── page.tsx                   # Owner dashboard
├── ads/
│   ├── page.tsx
│   └── [id]/
│       └── page.tsx
├── deposits/
│   └── page.tsx
├── monitoring/
│   └── page.tsx
└── users/
    └── page.tsx
```

---

## 🔄 Migration Steps

### Phase 1: Create New Route Groups
1. Create `/admin` folder with layout.tsx
2. Create `/owner` folder with layout.tsx
3. Update middleware for new paths

### Phase 2: Create Shared Components
1. Create `AdminSidebar` component
2. Create `OwnerSidebar` component
3. Create shared `DashboardLayout` wrapper

### Phase 3: Migrate Pages
1. Copy pages from `/app/admin/*` to `/admin/*`
2. Copy pages from `/app/owner/*` to `/owner/*`
3. Update all internal links

### Phase 4: Update Navigation
1. Update `AppSidebar` links to new URLs
2. Create redirect rules for old URLs

### Phase 5: Cleanup
1. Remove old `/app/admin/*` pages
2. Remove old `/app/owner/*` pages
3. Final testing

---

## 🛡️ Middleware Strategy

```typescript
// src/middleware.ts

// Protected paths requiring authentication
const protectedPaths = ["/app", "/admin", "/owner"];

// Role-based path restrictions
const adminPaths = ["/admin"];  // Requires organizer or owner
const ownerPaths = ["/owner"];  // Requires owner only

// Middleware logic:
// 1. Check if path requires auth
// 2. Validate JWT token
// 3. For admin paths: verify isOrganizer(role)
// 4. For owner paths: verify isOwner(role)
// 5. Redirect unauthorized access
```

---

## 🔗 Redirects (Backward Compatibility)

| Old URL | New URL | Status |
|---------|---------|--------|
| `/app/admin` | `/admin` | 301 |
| `/app/admin/leagues` | `/admin/leagues` | 301 |
| `/app/admin/bans` | `/admin/bans` | 301 |
| `/app/admin/reports` | `/admin/reports` | 301 |
| `/app/admin/wallet` | `/admin/wallet` | 301 |
| `/app/admin/create-tournament` | `/admin/create-tournament` | 301 |
| `/app/owner` | `/owner` | 301 |
| `/app/owner/ads` | `/owner/ads` | 301 |
| `/app/owner/deposits` | `/owner/deposits` | 301 |
| `/app/owner/monitoring` | `/owner/monitoring` | 301 |

---

## ✅ Validation Checklist

### Implementation Complete ✓
- [x] Admin can access `/admin/*` (role check in layout)
- [x] Owner can access `/owner/*` (role check in layout)
- [x] Owner can access `/admin/*` (organizer OR owner allowed)
- [x] Player cannot access `/admin/*` (redirected to /app)
- [x] Player cannot access `/owner/*` (redirected to /app)
- [x] Organizer cannot access `/owner/*` (redirected to /admin)
- [x] Old URLs redirect to new URLs (next.config.ts redirects)
- [x] All internal links updated to new paths
- [x] Navigation updated in AppSidebar

### Testing Required
- [ ] Verify admin features work in new locations
- [ ] Verify owner features work in new locations
- [ ] Test redirect from old URLs
- [ ] Validate all API endpoints still function

---

## 🧪 Test Cases

### Access Control
1. Login as player → Try `/admin` → Redirect to `/app`
2. Login as player → Try `/owner` → Redirect to `/app`
3. Login as organizer → Access `/admin` → Success
4. Login as organizer → Try `/owner` → Redirect to `/app`
5. Login as owner → Access `/admin` → Success
6. Login as owner → Access `/owner` → Success

### Redirects
1. Visit `/app/admin` → Redirect to `/admin`
2. Visit `/app/owner` → Redirect to `/owner`
3. Visit `/app/admin/leagues` → Redirect to `/admin/leagues`

### Functionality
1. Create tournament from `/admin/create-tournament`
2. Manage leagues from `/admin/leagues`
3. View deposits from `/owner/deposits`
4. Monitor system from `/owner/monitoring`
