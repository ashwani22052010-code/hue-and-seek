# ---------- build stage ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY . .
RUN npm run build

# ---------- runtime stage ----------
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app/server
# the server bundle only needs the server's runtime dependencies
COPY server/package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/client/dist /app/client/dist
EXPOSE 3001
USER node
CMD ["node", "--enable-source-maps", "dist/index.js"]
