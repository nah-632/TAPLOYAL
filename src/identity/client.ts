"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Browser-side Better Auth client.
 *
 * No baseURL is passed on purpose: the app is served from the same origin that
 * hosts /api/auth, so the default (current origin) is correct in every
 * environment and there is no chance of pointing a preview build at production.
 */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
