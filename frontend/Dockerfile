FROM node:24-alpine AS build

RUN npm install -g pnpm@11

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
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
