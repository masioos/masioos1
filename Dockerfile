# Production image: the Next.js app as one Node server. Used by compose.prod.yaml.
# No deploy pipeline yet (plan 0001, D18): build and run it by hand on the server.
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# The build needs a DATABASE_URL to pass env validation; it does not connect.
RUN DATABASE_URL=postgres://build/build pnpm build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
