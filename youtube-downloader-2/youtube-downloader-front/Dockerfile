FROM node:20-alpine

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build
RUN npm install -g serve

EXPOSE 5173

CMD ["serve", "-s", "dist", "-l", "5173"]

