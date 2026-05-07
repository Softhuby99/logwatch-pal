FROM node:20-alpine
RUN apk add --no-cache openssh-client
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY server.js ./
# Persistent SSH key dir
RUN mkdir -p /home/node/.ssh && chown -R node:node /home/node/.ssh && chmod 700 /home/node/.ssh
EXPOSE 3001
CMD ["node", "server.js"]
