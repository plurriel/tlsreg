import 'dotenv/config';
import { StartHTTP } from './http.js';
import { startConsume } from './queue.js';

await StartHTTP();
await startConsume();

if (process.env.UID && !Number.isNaN(+process.env.UID) && process.setuid) process.setuid(+process.env.UID);
