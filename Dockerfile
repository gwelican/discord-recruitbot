FROM node:alpine

WORKDIR /src
COPY . /src
RUN npm install
CMD ["npm", "start"]
