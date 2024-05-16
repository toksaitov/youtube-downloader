FROM node:20-alpine

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 2020

CMD ["npm", "start"]
