import fs from "node:fs";
import { request } from "@playwright/test";

/** Setup global (pivot 2026-08-22 : Orion est privé) : toute la suite
 *  e2e navigue CONNECTÉE. Une session est créée par l'API en mode dev
 *  (ORION_AUTH_DEV=1 dans le .env de la pile locale) et écrite en
 *  storageState — chaque spec démarre avec le cookie.
 *
 *  Huit adresses approuvées, choisie par la minute courante : le
 *  cooldown de 60 s par email ne mord jamais deux runs rapprochés. */

const EMAILS = "abcdefgh".split("").map((letter) => `e2e-${letter}@lensorion.test`);
export const STORAGE_STATE = "e2e/.auth/session.json";

export default async function globalSetup() {
  const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:8080";
  const email = EMAILS[new Date().getMinutes() % EMAILS.length];

  const api = await request.newContext({ baseURL });
  // Deux runs dans la même minute partagent la première adresse et son
  // cooldown de 60 s — on essaie les suivantes jusqu'à obtenir un lien.
  let devLink: string | undefined;
  const start = EMAILS.indexOf(email);
  for (let step = 0; step < EMAILS.length && !devLink; step += 1) {
    const candidate = EMAILS[(start + step) % EMAILS.length];
    const login = await api.post("/api/auth/login", { data: { email: candidate } });
    devLink = (await login.json()).dev_link;
  }
  if (!devLink) {
    throw new Error(
      "auth.setup : aucun dev_link sur les 8 adresses — la pile a-t-elle " +
        "ORION_AUTH_DEV=1 et les adresses e2e dans ORION_LOGIN_ALLOWLIST ?",
    );
  }
  const token = devLink.split("#token=")[1];
  const verify = await api.post("/api/auth/verify", { data: { token } });
  if (!verify.ok()) throw new Error(`auth.setup : verify a répondu ${verify.status()}`);

  // Le cookie est reconstruit à la main : les jars ne gardent pas tous
  // un cookie Secure reçu sur http://localhost — le storageState écrit
  // explicitement ce que le navigateur recevra.
  const setCookie = verify.headers()["set-cookie"] ?? "";
  const match = setCookie.match(/__Host-orion_session=([^;]+)/);
  if (!match) throw new Error("auth.setup : pas de cookie de session dans la réponse");

  fs.mkdirSync("e2e/.auth", { recursive: true });
  fs.writeFileSync(
    STORAGE_STATE,
    JSON.stringify({
      cookies: [
        {
          name: "__Host-orion_session",
          value: match[1],
          domain: new URL(baseURL).hostname,
          path: "/",
          expires: -1,
          httpOnly: true,
          secure: true,
          sameSite: "Lax",
        },
      ],
      origins: [],
    }),
  );
  await api.dispose();
}
