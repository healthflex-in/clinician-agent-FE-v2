FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_API_KEY
ARG VITE_WS_API_KEY

ENV VITE_API_URL=$VITE_API_URL \
    VITE_WS_URL=$VITE_WS_URL \
    VITE_API_KEY=$VITE_API_KEY \
    VITE_WS_API_KEY=$VITE_WS_API_KEY

RUN test -n "$VITE_API_URL" \
    && test -n "$VITE_WS_URL" \
    && test -n "$VITE_API_KEY" \
    && test -n "$VITE_WS_API_KEY" \
    && npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
