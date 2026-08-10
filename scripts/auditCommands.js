import { createCommandRegistry } from '../commands/index.js';
const registry=createCommandRegistry({});
console.log(JSON.stringify({ok:true,count:registry.audit.commandCount,duplicates:registry.audit.duplicates,invalid:registry.audit.invalid,names:registry.audit.names},null,2));
