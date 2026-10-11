// Isolate worker-local discovery from the daemon; its caller bounds and kills this process group.
import { sweep, type Holder } from './suite-lock.ts';
await sweep(JSON.parse(process.argv[2]!) as Holder);
