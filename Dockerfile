FROM node:alpine

WORKDIR /src
COPY . /src
RUN yarn install
CMD ["npm", "start"]
