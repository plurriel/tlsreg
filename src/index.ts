import 'dotenv/config';
import { StartHTTP } from './http.js';
import { startConsume } from './queue.js';

await StartHTTP();
await startConsume();