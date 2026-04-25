import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "absensya_session";
const AUTH_LOOKUP_TIMEOUT_MS = 5000;
const AUTH_WRITE_TIMEOUT_MS = 8000;

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  shop: {
    id: string;
    name: string;
  };
};

export async function withTimeout<T>(promise: Promise<T>, timeoutMs = AUTH_LOOKUP_TIMEOUT_MS) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<null>((resolve) => {
    timeout = setTimeout(() => resolve(null), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is required");
  }
  return secret;
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

function createToken(userId: string) {
  const payload = `${userId}.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = sign(payload);
  const provided = parts[2];

  if (expected.length !== provided.length) return null;
  const valid = timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  if (!valid) return null;

  return { userId: parts[0] };
}

export async function login(email: string, password: string) {
  try {
    const user = await withTimeout(prisma.user.findUnique({ where: { email } }), AUTH_WRITE_TIMEOUT_MS);
    if (!user) return false;

    const ok = await withTimeout(bcrypt.compare(password, user.passwordHash), AUTH_WRITE_TIMEOUT_MS);
    if (!ok) return false;

    const store = await cookies();
    store.set(SESSION_COOKIE, createToken(user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7
    });

    return true;
  } catch (error) {
    console.error("Unable to complete login", error);
    return false;
  }
}

export async function register({
  ownerName,
  shopName,
  email,
  password
}: {
  ownerName: string;
  shopName: string;
  email: string;
  password: string;
}) {
  const passwordHash = await withTimeout(bcrypt.hash(password, 10), AUTH_WRITE_TIMEOUT_MS);
  if (!passwordHash) {
    throw new Error("Unable to hash password before timeout.");
  }

  const user = await withTimeout(
    prisma.$transaction(async (tx) => {
      const createdShop = await tx.shop.create({
        data: {
          name: shopName
        }
      });

      await tx.payrollSettings.create({
        data: {
          shopId: createdShop.id,
          frequency: "WEEKLY",
          weeklyPayDay: 5,
          autoGenerate: true
        }
      });

      return tx.user.create({
        data: {
          email,
          passwordHash,
          name: ownerName,
          shopId: createdShop.id
        }
      });
    }),
    AUTH_WRITE_TIMEOUT_MS
  );

  if (!user) {
    throw new Error("Registration timed out while contacting the database.");
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, createToken(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });

  return user;
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  try {
    return await withTimeout(
      prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          name: true,
          shop: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })
    );
  } catch (error) {
    console.error("Unable to load current user session", error);
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
