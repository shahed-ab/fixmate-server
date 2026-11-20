# Authentication & Role-Based Authorization (Better Auth + Express Backend)

## Architecture

```
┌────────────────────┐
│ Next.js Frontend   │
│ Better Auth        │
└─────────┬──────────┘
          │
          │ Login
          ▼
   Better Auth Server
          │
          │ Generates JWT
          ▼
Frontend receives JWT
          │
          │ Authorization: Bearer <token>
          ▼
────────────────────────────────────────
 Express Backend
────────────────────────────────────────
          │
          ▼
verifyToken Middleware
          │
          ▼
Verify JWT using Better Auth JWKS
          │
          ▼
Extract user information
          │
          ▼
Sync/Create User in Database
          │
          ▼
Attach req.user
          │
          ▼
Role Middleware
(admin / organizer / attendee)
          │
          ▼
Protected Route
```

---

# Better Auth Configuration

Only the **role** field is added to the user model.

```tsx
user: {
    additionalFields: {
        role: {
            type: "string",
            required: true,
            defaultValue: "student",
            input: true
        }
    }
},
session: {
  cookieCache: {
    enabled: true,
    strategy: "jwt",
    maxAge: 5 * 24 * 60 * 60,
  },
},
plugins: [
    jwt()
]
```

Because `role` is part of Better Auth's user model, it is also included in the JWT payload after login.

On the auth.js:

```jsx
plugins: [
    jwtClient(),
    inferAdditionalFields()
]
```

## Why enable cookieCache?

When a user logs in through Better Auth:

- Better Auth stores the session in an **HTTP-only cookie**.
- The cookie is automatically sent to the Next.js server.
- The cookie allows Better Auth APIs (such as `getSession()`) to retrieve the current authenticated user without requiring manual token handling.

This cookie is **only used by Better Auth** and is not used directly by the Express backend.

---

# Frontend Authentication

# **Client-Side Authentication**

After login,

```tsx
const session = await authClient.getSession();
```

Better Auth returns

```tsx
session.data.user
session.data.token
```

The token is attached while calling the backend.

```tsx
fetch(API_URL,{
    headers:{
        Authorization:`Bearer ${session.data.token}`
    }
})
```

# **Server-Side Authentication**

On the server side (Next.js Server Components, Server Actions, or Route Handlers), use `auth.api.getSession()` with the request headers.

```jsx
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

const session = await auth.api.getSession({
    headers: await headers(),
});
```

Better Auth returns:

```
session.user
session.session.token
```

The token can then be attached while calling your backend.

```jsx
const response = await fetch(API_URL, {
    headers: {
        Authorization: `Bearer ${session.session.token}`,
    },
});
```

**Important:** Always check whether a session exists before accessing its properties.

```jsx
if (!session) {
    throw new Error("Unauthorized");
}
```

---

# Backend JWT Verification

Every protected route should first verify the incoming JWT.

Example middleware:

```tsx
const verifyToken = async (req, res, next) => {
    let token = req.headers.authorization;

    if (token?.startsWith("Bearer ")) {
        token = token.split(" ")[1];
    }

    if (!token) {
        return res.status(401).json({
            message: "Unauthorized"
        });
    }

    try {
        const { payload } = await jwtVerify(token, JWKS);

        req.user = payload;

        next();

    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
};
```

---

# What is JWKS?

Better Auth signs every JWT using its private key.

The Express server must verify that signature using Better Auth's **public keys**.

Those public keys are exposed through

```
/api/auth/jwks
```

Create the verifier once during server startup.

```tsx
const JWKS = createRemoteJWKSet(
    new URL(`${CLIENT_URL}/api/auth/jwks`)
);
```

Then verify every incoming token.

```tsx
const { payload } = await jwtVerify(token, JWKS);
```

If verification fails,

- token is expired
- token is modified
- token was not issued by Better Auth

the request should immediately return **401 Unauthorized**.

---

# Verify User From Database

A valid JWT only proves **identity**.

The backend should still load the latest user information from its own database.

```tsx
const user = await usersCollection.findOne({
    email: payload.email
});
```

If the user does not exist,

```tsx
await usersCollection.insertOne({
    email: payload.email,
    name: payload.name,
    role: payload.role
});
```

This synchronization allows the backend to maintain its own user records while trusting Better Auth for authentication.

---

# Attach Authenticated User

After successful verification,

```tsx
req.user = {
    id: user._id,
    email: user.email,
    role: user.role,
    name: user.name
};
```

Controllers should always use `req.user` instead of trusting any client-provided user information.

---

# Role Verification Middleware

Authentication checks **who the user is**.

Authorization checks **what the user can do**.

Example Admin middleware:

```tsx
const verifyAdmin = (req, res, next) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({
            message: "Admin access required"
        });
    }

    next();
};
```

Example Mentor middleware:

```tsx
const verifyMentor = (req, res, next) => {
    if (req.user.role !== "mentor") {
        return res.status(403).json({
            message: "Mentor access required"
        });
    }

    next();
};
```

Example Student middleware:

```tsx
const verifyStudent = (req, res, next) => {
    if (req.user.role !== "student") {
        return res.status(403).json({
            message: "Student access required"
        });
    }

    next();
};
```

---

# Protecting Routes

Authenticated route

```tsx
router.get(
    "/profile",
    verifyToken,
    getProfile
);
```

Admin route

```tsx
router.patch(
    "/courses/:id",
    verifyToken,
    verifyAdmin,
    updateCourse
);
```

Mentor route

```tsx
router.post(
    "/courses",
    verifyToken,
    verifyMentor,
    createCourse
);
```

Student route

```tsx
router.post(
    "/enroll",
    verifyToken,
    verifyStudent,
    enrollCourse
);
```

---

# Complete Request Flow

```
User Login
      │
      ▼
Better Auth
      │
      ├───────────────┐
      │               │
HTTP Only Cookie      JWT Token
      │               │
      ▼               ▼
Next.js         Express API Request
                     │
                     ▼
        Authorization: Bearer <JWT>
                     │
                     ▼
             verifyToken Middleware
                     │
                     ▼
          jwtVerify(token, JWKS)
                     │
                     ▼
         Find/Create User in Database
                     │
                     ▼
           Attach req.user
                     │
                     ▼
          verifyRole Middleware
                     │
                     ▼
              Controller Logic
                     │
                     ▼
                 API Response
```

This version reflects the actual Better Auth architecture you're using: **Better Auth manages authentication and sessions (including the HTTP-only cookie cache), while the Express backend independently validates the JWT via JWKS, synchronizes the user record, and enforces role-based authorization before executing protected business logic.**