import amqplib from 'amqplib';
import acme from 'acme-client';

import { Redis } from '@upstash/redis';

import { resolve } from 'dns/promises';
import { X509Certificate, createPrivateKey } from 'crypto';
import { challenges } from './store.js';
import { fancy } from './fancy.js';
import { BSON } from 'bson';

if (typeof process.env.AMQP_URL !== 'string') throw new Error('AMQP_URL is required in env');
if (typeof process.env.PUBLIC_IP !== 'string') throw new Error('PUBLIC_IP is required in env');

if (typeof process.env.REDIS_URL !== 'string') throw new Error('REDIS_URL is required in env');
if (typeof process.env.REDIS_TOKEN !== 'string') throw new Error('REDIS_TOKEN is required in env');

const queue = 'tls_registration';
const conn = await amqplib.connect(process.env.AMQP_URL as string);

const ch = await conn.createChannel();
await ch.assertQueue(queue);

const redis = new Redis({
  url: process.env.REDIS_URL as string,
  token: process.env.REDIS_TOKEN as string,
});

export const StartConsume = async () => {
  // Listener
  await ch.consume(queue, async (msg) => {
    if (msg !== null) {
      const domainName = msg.content.toString();
      const req = await resolve(domainName);
      if (req.length !== 1 || req[0] !== process.env.PUBLIC_IP as string) throw new Error('Either incorrect DNS or sent to wrong consumer');

      /* Init client */
      const client = new acme.Client({
        directoryUrl: acme.directory.letsencrypt.production,
        accountKey: await acme.crypto.createPrivateKey()
      });

      /* Create CSR */
      const [key, csr] = await acme.crypto.createCsr({
        commonName: domainName,
      });

      /* Certificate */
      const bigCert = await client.auto({
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

      const keyDer = createPrivateKey(key).export({
        type: 'pkcs8',
        format: 'der',
      });

      // console.log(cert, key);
      const certs = bigCert.trim().split('\n\n').map((cert) => new X509Certificate(cert));

      const [cert] = certs.filter((cert) => !cert.ca);
      const cas = certs.filter((cert) => cert.ca);
    
      const domainData = BSON.serialize({
        type: 'domain',
        dependencies: cas.map((ca) => ca.subject),
        key: keyDer,
        data: cert.raw,
      });

      await redis.mset(Object.fromEntries([
        [
          domainName,
          [...domainData].map((v) => String.fromCharCode(v)).join(''),
        ],
        ...cas.map((ca) => [
          ca.subject,
          [...ca.raw].map((v) => String.fromCharCode(v)).join(''),
        ]),
      ]));

      ch.ack(msg);
    } else {
      console.log('Consumer cancelled by server');
    }
  }, {
    consumerTag: process.env.PUBLIC_IP as string,
  });
  console.log(fancy.up('AMQP consumer'));
};
