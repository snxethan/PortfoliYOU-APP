# Smoke Test Checklist - Issue #28

This document provides a comprehensive smoke test checklist for verifying the packaged Electron app on Windows and macOS.

## Pre-Build Requirements

### 1. Build the Application

**Windows:**
```powershell
npm run dist
```

**macOS:**
```bash
npm run dist
```

The packaged app will be in the `dist/` folder.

---

## Test Suite

### ✅ Google Authentication

**Test Steps:**
1. Launch the packaged application
2. Navigate to the Sidebar (left panel)
3. Click "Continue with Google" button
4. **Expected:** OAuth popup window opens (not system browser)
5. Sign in with a Google account
6. **Expected:** Account picker appears (due to `prompt: 'select_account'`)
7. Select an account and authorize
8. **Expected:** 
   - Popup closes automatically
   - User is signed in
   - Email/UID displayed in sidebar under "Account"
   - Console logs: `✅ Google Sign-In Success` and `🔄 Auth State Change - User Signed In`

**Sign Out Test:**
1. Click "Sign out" button in sidebar
2. **Expected:**
   - User redirected to home page (`/`)
   - Account section shows sign-in form again
   - Console logs: `🚪 Sign-Out` and `✅ Sign-Out Success`

**Account Switching:**
1. Click "Continue with Google" again
2. **Expected:** Account picker appears (can choose different account)
3. Select different Google account
4. **Expected:** Signs in with new account

---

### ❌ Microsoft Login (Not Implemented)

**Note:** Currently, only Google and Email/Password authentication are implemented. Microsoft login is not available yet.

**Future Implementation Needed:**
- Add Microsoft Auth provider to Firebase
- Update `auth.ts` with Microsoft sign-in function
- Add Microsoft button to `SignInCard.tsx`

---

### ✅ Email/Password Authentication

**Sign Up Test:**
1. Enter email and password in sidebar form
2. Click "Create" button
3. **Expected:**
   - Verification email sent
   - User signed in
   - Warning message: "Email not verified. Check inbox before using cloud features."
   - Console logs: `✅ Email Sign-Up Success`

**Sign In Test:**
1. Sign out if signed in
2. Enter email and password
3. Click "Sign in" button
4. **Expected:**
   - User signed in
   - Console logs: `✅ Email Sign-In Success`

---

### ✅ Protected Routes (Guarded Navigation)

**Test Steps:**

#### Test 1: Access Protected Routes Without Projects
1. Make sure you have no projects created (fresh install or clear localStorage)
2. Sign in with Google or Email
3. **Expected:** Sidebar does NOT show "Modify" or "Deploy" links
4. Try to navigate to `/modify` (via URL bar)
5. **Expected:** 
   - Loading spinner briefly appears
   - Automatically redirected to `/` (home page)
   - Cannot access the page

6. Try to navigate to `/deploy`
7. **Expected:**
   - Loading spinner briefly appears
   - Automatically redirected to `/` (home page)

#### Test 2: Access Protected Routes With Projects (Signed Out)
1. Sign out (or fresh start, signed out)
2. Click "New portfolio" or "Import .portfoliyou" on home page
3. **Expected:** 
   - Project created
   - Sidebar now shows "Modify" and "Deploy" links
   - Links are visible even though you're signed out

4. Click "Modify" link
5. **Expected:**
   - Route changes to `/modify`
   - ModifyPage content displayed
   - No redirect (routes are project-gated, not auth-gated)

#### Test 3: Access Protected Routes With Projects (Signed In)
1. Sign in with Google or Email
2. Create a project if none exists
3. **Expected:** Sidebar shows "Modify" and "Deploy" links
4. Click "Modify" link
5. **Expected:**
   - Route changes to `/modify`
   - ModifyPage content displayed
   - No redirect

6. Click "Deploy" link
7. **Expected:**
   - Route changes to `/deploy`
   - DeployPage content displayed
   - No redirect

#### Test 4: Delete All Projects While on Protected Route
1. Navigate to `/modify` or `/deploy` with a project
2. Delete or clear all projects (via localStorage or app UI when implemented)
3. Try to navigate or refresh
4. **Expected:**
   - Automatically redirected to `/` (home page)
   - Sidebar hides "Modify" and "Deploy" links

---

### ✅ Sidebar Navigation

**Visual Test:**
1. Launch app (signed out, no projects)
2. **Expected Sidebar Structure:**
   - "PORTFOLI-YOU" header
   - "Home" navigation link (always visible)
   - "Modify" link (HIDDEN - no projects exist)
   - "Deploy" link (HIDDEN - no projects exist)
   - Sign-in card at bottom (divider above)

3. Create a new portfolio (click "New portfolio" button)
4. **Expected:**
   - "Modify" link now VISIBLE
   - "Deploy" link now VISIBLE
   - Links visible regardless of sign-in state

5. Sign in with Google
6. **Expected:**
   - Sign-in form replaced with account info
   - Shows "Signed in" with email
   - "Sign out" button visible
   - "Modify" and "Deploy" links still visible (because project exists)

7. Sign out
8. **Expected:**
   - Account info replaced with sign-in form
   - "Modify" and "Deploy" links STILL VISIBLE (project still exists)
   - Routes are project-gated, not auth-gated

**Navigation Test:**
1. Click "Home" link
2. **Expected:**
   - Route changes to `/`
   - Link highlighted with `nav-active` class
   - HomePage content displayed

3. Click "Modify" link (if available)
4. **Expected:**
   - Route changes to `/modify`
   - Link highlighted
   - ModifyPage content displayed

5. Click "Deploy" link (if available)
6. **Expected:**
   - Route changes to `/deploy`
   - Link highlighted
   - DeployPage content displayed

**Active State Test:**
1. Navigate to each route
2. **Expected:** Corresponding sidebar link is highlighted
3. Only one link highlighted at a time

---

### ✅ Loading States

**Initial App Load:**
1. Launch packaged app
2. **Expected:**
   - "Initializing..." spinner shows briefly while checking auth
   - Then app content loads

**Protected Route Access:**
1. Sign out
2. Try to access `/modify` or `/deploy`
3. **Expected:**
   - "Loading..." spinner shows briefly
   - Then redirects to home

---

### ✅ Persistence

**Session Persistence Test:**
1. Sign in with Google or Email
2. Close the application completely
3. Reopen the application
4. **Expected:**
   - User still signed in (no re-authentication needed)
   - Email/UID displayed in sidebar
   - Console logs: `🔄 Auth State Change - User Signed In`
   - Protected routes accessible

**Sign Out Persistence:**
1. Sign out
2. Close and reopen app
3. **Expected:**
   - User remains signed out
   - Sign-in form visible

---

### ✅ External Links

**Test Steps:**
1. Navigate to Home page
2. Click "Website" link in PromoBar
3. **Expected:** Opens in system browser (not Electron window)

4. Click "FAQ" link
5. **Expected:** Opens in system browser

6. Click "Changelog" link
7. **Expected:** Opens in system browser

---

### ✅ Error Handling

**Invalid Credentials:**
1. Try to sign in with wrong email/password
2. **Expected:**
   - Error message displayed in red box
   - Console logs: `❌ Email Sign-In Error`

**Network Error:**
1. Disconnect internet
2. Try to sign in with Google
3. **Expected:**
   - Error message displayed
   - Console logs error

---

## Platform-Specific Tests

### Windows-Specific

- [ ] App icon displays correctly
- [ ] Window controls (minimize, maximize, close) work
- [ ] App appears in Start Menu
- [ ] OAuth popup window appears centered on screen
- [ ] File paths resolve correctly (no Unix path issues)

### macOS-Specific

- [ ] App icon displays correctly in Dock
- [ ] Window controls (red, yellow, green buttons) work
- [ ] App appears in Applications folder
- [ ] OAuth popup window appears centered on screen
- [ ] DMG installer works (if created)
- [ ] Gatekeeper doesn't block app (may need code signing)

---

## Console Logging Verification

Open DevTools (Ctrl+Shift+I / Cmd+Option+I) and verify:

### Expected Console Logs:

**On Google Sign-In:**
```
✅ Google Sign-In Success: { email, uid, provider: 'google.com' }
🔄 Auth State Change - User Signed In: { email, uid, provider, emailVerified }
```

**On Email Sign-Up:**
```
✅ Email Sign-Up Success: { email, uid, provider: 'email', emailVerified }
🔄 Auth State Change - User Signed In: { email, uid, provider, emailVerified }
```

**On Sign-Out:**
```
🚪 Sign-Out: { email, uid, provider }
✅ Sign-Out Success
🔄 Auth State Change - User Signed Out
```

**On App Reload (while signed in):**
```
🔄 Auth State Change - User Signed In: { email, uid, provider, emailVerified }
```

---

## Known Issues / Limitations

1. **Microsoft Login**: Not implemented yet (only Google and Email/Password)
2. **Email Verification**: Warning shown but doesn't block access to protected routes
3. **Offline Mode**: App requires internet for authentication (Firebase Auth)

---

## Test Results Template

### Windows Test Results
- **Tester Name:** 
- **Date:** 
- **Windows Version:** 
- **App Version:** 

| Test Case | Status | Notes |
|-----------|--------|-------|
| Google Sign-In | ⬜ Pass / ❌ Fail | |
| Google Sign-Out | ⬜ Pass / ❌ Fail | |
| Email Sign-Up | ⬜ Pass / ❌ Fail | |
| Email Sign-In | ⬜ Pass / ❌ Fail | |
| Protected Routes (Signed Out) | ⬜ Pass / ❌ Fail | |
| Protected Routes (Signed In) | ⬜ Pass / ❌ Fail | |
| Sidebar Navigation | ⬜ Pass / ❌ Fail | |
| Session Persistence | ⬜ Pass / ❌ Fail | |
| External Links | ⬜ Pass / ❌ Fail | |
| Console Logging | ⬜ Pass / ❌ Fail | |

---

### macOS Test Results
- **Tester Name:** 
- **Date:** 
- **macOS Version:** 
- **App Version:** 

| Test Case | Status | Notes |
|-----------|--------|-------|
| Google Sign-In | ⬜ Pass / ❌ Fail | |
| Google Sign-Out | ⬜ Pass / ❌ Fail | |
| Email Sign-Up | ⬜ Pass / ❌ Fail | |
| Email Sign-In | ⬜ Pass / ❌ Fail | |
| Protected Routes (Signed Out) | ⬜ Pass / ❌ Fail | |
| Protected Routes (Signed In) | ⬜ Pass / ❌ Fail | |
| Sidebar Navigation | ⬜ Pass / ❌ Fail | |
| Session Persistence | ⬜ Pass / ❌ Fail | |
| External Links | ⬜ Pass / ❌ Fail | |
| Console Logging | ⬜ Pass / ❌ Fail | |

---

## Critical Blockers

These issues should prevent shipping:

- [ ] Cannot sign in with Google
- [ ] Cannot sign out
- [ ] Protected routes accessible when signed out
- [ ] App crashes on launch
- [ ] OAuth popup blocked/doesn't work

## High Priority Issues

These should be fixed before release:

- [ ] Session doesn't persist after app restart
- [ ] Navigation breaks
- [ ] External links open in Electron window
- [ ] Console errors on normal operation

## Low Priority Issues

These can be addressed in future updates:

- [ ] UI/styling inconsistencies
- [ ] Missing analytics tracking
- [ ] Email verification not enforced
- [ ] Missing Microsoft login option
