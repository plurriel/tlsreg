import fastify from 'fastify';
import { fancy } from './fancy.js';
import { challenges } from './store.js';

const app = fastify();

if (!process.env.HTTP_PORT || Number.isNaN(+process.env.HTTP_PORT)) throw new Error('HTTP_PORT should be a number in env');

app.get<{
  Params: {
    token: string;
  },
}>('/.well-known/acme-challenge/:token', (request, reply) => {
  if (challenges.has(`${request.hostname}:${request.params.token}`)) {
    reply.status(200);
    reply.send(challenges.get(`${request.hostname}:${request.params.token}`));
  } else {
    reply.callNotFound();
  }
});

export function StartHTTP() {
  return new Promise<void>((res) => {
    app.listen({
      port: +(process.env.HTTP_PORT as string),
      host: '0.0.0.0',
    }, (err) => {
      if (err) throw err;
      console.log(fancy.up('HTTP server'));
      res();
    });
  });
}
