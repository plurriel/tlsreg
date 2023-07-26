import 'dotenv/config';
import { StartHTTP } from './http.js';
import { StartConsume } from './queue.js';

await StartHTTP();
await StartConsume();

if (process.env.UID && !Number.isNaN(+process.env.UID) && process.setuid) process.setuid(+process.env.UID);
