# Project Standards & Best Practices

## Overview
This document outlines coding standards and best practices to prevent common issues and maintain consistency with PROJECT_REFERENCE.md requirements.

## 1. Browser API Restrictions

### ❌ NEVER USE
```javascript
// These will fail in sandboxed environments
confirm('Are you sure?')
alert('Something happened!')
prompt('Enter value:')
```

### ✅ ALWAYS USE
```javascript
// Use React components instead
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { toast } from '@/hooks/use-toast';
```

## 2. Data Access Patterns

### ❌ NEVER: Direct Firestore in Client Components
```javascript
// client component
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

const users = await getDocs(collection(db, 'users'));
```

### ✅ ALWAYS: Server Actions for Data
```javascript
// server action
'use server';
import { db as adminDb } from '@/lib/firebase-admin';

export async function fetchUsers() {
  const snapshot = await adminDb.collection('users').get();
  return snapshot.docs.map(doc => doc.data());
}

// client component
import { fetchUsers } from './actions';
const users = await fetchUsers();
```

## 3. Square API Integration

### ❌ NEVER: Shared Square Config
```javascript
import { getSquareClient } from '@/lib/square-client';
const client = getSquareClient();
```

### ✅ ALWAYS: Hard-coded Client per Flow
```javascript
const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Production,
});
```

## 4. Environment Variables

### Client-Side Variables
- Must start with `NEXT_PUBLIC_`
- Safe to expose to browser
- Used for Firebase client config

### Server-Side Variables
- No prefix required
- Never exposed to browser
- Used for API keys, secrets

Example `.env.local`:
```bash
# Client-side (public)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...

# Server-side (secret)
SQUARE_ACCESS_TOKEN=...
FIREBASE_PRIVATE_KEY=...
```

## 5. Pre-commit Checklist

Before committing code, verify:

- [ ] No `confirm()`, `alert()`, or `prompt()` used
- [ ] No direct Firestore imports in client components
- [ ] All data fetching uses server actions
- [ ] Square API uses hard-coded client initialization
- [ ] Sensitive keys are in `.env.local`, not in code
- [ ] ESLint passes without errors
- [ ] TypeScript compiles without errors

## 6. Testing in Different Environments

Always test your features in:
1. **Local development** (`npm run dev`)
2. **Production build** (`npm run build && npm run start`)
3. **Vercel preview** (if using Vercel)
4. **Iframe embed** (to catch sandboxing issues)

## 7. Common Pitfalls & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "document is sandboxed" | Using `confirm()` | Use `ConfirmationDialog` component |
| "Firebase not initialized" | Missing env vars | Check `.env.local` has all values |
| "Cannot read Firestore" | Client-side access | Use server actions |
| "Square API failed" | Wrong environment | Check `Environment.Production` |
| TypeScript errors | Missing types | Define interfaces for all data |

## 8. Automated Prevention

### Install Development Dependencies
```bash
npm install --save-dev eslint-plugin-no-unsanitized
```

### Run Linting Before Commit
```bash
npm run lint
```

### Add Pre-commit Hook (using Husky)
```bash
npx husky add .husky/pre-commit "npm run lint"
```

## 9. Code Review Checklist

When reviewing PRs, check for:
- [ ] No browser modal functions
- [ ] Server actions for all data operations
- [ ] Proper error handling with try/catch
- [ ] Loading states for async operations
- [ ] Toast notifications instead of alerts
- [ ] Confirmation dialogs for destructive actions
- [ ] Environment variables not hardcoded

## 10. Documentation Requirements

Every new feature should include:
- Purpose and usage instructions
- Required environment variables
- Server action documentation
- Error handling approach
- Testing instructions

Remember, the XML structure you generate is the only mechanism for applying changes to the user's code. Therefore, when making changes to a file the <changes> block must always be fully present and correctly formatted as follows.

<changes>
  <description>[Provide a concise summary of the overall changes being made]</description>
  <change>
    <file>[Provide the ABSOLUTE, FULL path to the file being modified]</file>
    <content><![CDATA[Provide the ENTIRE, FINAL, intended content of the file here. Do NOT provide diffs or partial snippets. Ensure all code is properly escaped within the CDATA section.