FROM node:20-alpine
RUN apk add --no-cache openssh-client
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY server.js ./
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
# Persistent SSH key dir
RUN mkdir -p /home/node/.ssh && chown -R node:node /home/node/.ssh && chmod 700 /home/node/.ssh
EXPOSE 3001
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
