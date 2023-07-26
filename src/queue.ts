import amqplib from 'amqplib';
import acme from 'acme-client';

import { resolve } from 'dns/promises';
import { challenges } from './store.js';

if (typeof process.env.AMQP_URL !== 'string') throw new Error('AMQP_URL is required in env');
if (typeof process.env.PUBLIC_IP !== 'string') throw new Error('PUBLIC_IP is required in env');

const queue = 'tls_registration';
const conn = await amqplib.connect(process.env.AMQP_URL as string);

const ch = await conn.createChannel();
await ch.assertQueue(queue);

export const startConsume = async () => {
  // Listener
  ch.consume(queue, async (msg) => {
    if (msg !== null) {
      const domainName = msg.content.toString();
      const req = await resolve(domainName);
      if (req.length !== 1 || req[0] !== process.env.PUBLIC_IP as string) throw new Error('Either incorrect DNS or sent to wrong consumer');

      /* Init client */
      const client = new acme.Client({
        directoryUrl: acme.directory.letsencrypt.staging,
        accountKey: await acme.crypto.createPrivateKey()
      });

      /* Create CSR */
      const [key, csr] = await acme.crypto.createCsr({
        commonName: domainName,
      });

      /* Certificate */
      const cert = await client.auto({
        csr,
        email: 'redacted-for@privacy.plurriel.email',
        termsOfServiceAgreed: true,
        challengePriority: ['http-01'],
        challengeCreateFn: async (authz, challenge, keyAuthorization) => {
          if (challenge.type === 'http-01') {
            challenges.set(`${domainName}:${challenge.token}`, keyAuthorization);
          }
        },
        challengeRemoveFn: async (authz, challenge, keyAuthorization) => {
          if (challenge.type === 'http-01') {
            challenges.delete(`${domainName}:${challenge.token}`);
          }
        },
      });

      console.log(cert, key);
    } else {
      console.log('Consumer cancelled by server');
    }
  }, {
    consumerTag: process.env.PUBLIC_IP as string,
  });
};
