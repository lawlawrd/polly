import bcrypt from "bcryptjs";

import db from "../db/index.js";

const SALT_ROUNDS = 12;

export const findUserByEmail = (email) => {
  if (typeof email !== "string") return null;
  const statement = db.prepare(
    "SELECT id, email, first_name AS firstName, last_name AS lastName, password_hash AS passwordHash FROM users WHERE email = ?",
  );
  return statement.get(email.toLowerCase());
};

export const findUserById = (id) => {
  if (!id) return null;
  const statement = db.prepare(
    "SELECT id, email, first_name AS firstName, last_name AS lastName, password_hash AS passwordHash FROM users WHERE id = ?",
  );
  return statement.get(id);
};

export const createUser = async ({ email, firstName, lastName, password }) => {
  if (!email || !firstName || !lastName || !password) {
    throw new Error("All required fields must be provided.");
  }

  const normalizedEmail = email.toLowerCase();

  const existing = findUserByEmail(normalizedEmail);
  if (existing) {
    const error = new Error("A user with that email already exists.");
    error.code = "USER_EXISTS";
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const statement = db.prepare(
    "INSERT INTO users (email, first_name, last_name, password_hash) VALUES (?, ?, ?, ?)",
  );
  const result = statement.run(normalizedEmail, firstName.trim(), lastName.trim(), passwordHash);

  return {
    id: result.lastInsertRowid,
    email: normalizedEmail,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
  };
};

export const verifyPassword = async (user, password) => {
  if (!user || typeof user.passwordHash !== "string") return false;
  return bcrypt.compare(password, user.passwordHash);
};

export default {
  findUserByEmail,
  findUserById,
  createUser,
  verifyPassword,
};
