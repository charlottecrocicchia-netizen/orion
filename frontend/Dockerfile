FROM node:24-alpine AS build

RUN npm install -g pnpm@11

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# La marque au BUILD (dette soldée le 2026-08-23) : frontend/.env est
# gitignoré et n'entre jamais dans ce contexte — sans cette valeur,
# Vite servait littéralement « %VITE_APP_BRAND% » dans le HTML initial
# (l'onglet clignotait avant que React répare document.title). Même
# défaut sûr que les replis runtime (brand.ts, use-document-title).
ARG VITE_APP_BRAND=Orion
ENV VITE_APP_BRAND=$VITE_APP_BRAND
RUN pnpm build

FROM caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv

# Le tampon de révision (2026-08-17) : c'est CETTE image qui portait la
# vieille version du site ouverte en silence par le lanceur. Elle dit
# désormais de quelles sources elle sort. En dernier : l'ARG n'invalide
# que ce calque, jamais le `pnpm build`.
ARG GIT_REV=inconnu
LABEL org.opencontainers.image.revision=$GIT_REV

EXPOSE 80
