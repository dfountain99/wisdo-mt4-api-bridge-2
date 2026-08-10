import { readFile } from 'node:fs/promises';

const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const render=await readFile(new URL('../render.yaml',import.meta.url),'utf8');
const index=await readFile(new URL('../index.js',import.meta.url),'utf8');
const result={productionEntrypoint:pkg.scripts?.start,renderStartCommand:render.match(/startCommand:\s*(.+)/)?.[1]?.trim(),discordRegistry:/createCommandRegistry/.test(index)?'commands/index.js':null,apiServer:/startApiServer/.test(index)?'server/apiServer.js':null,nodeEngine:pkg.engines?.node,canonical:true};
result.canonical=result.productionEntrypoint==='node index.js'&&result.renderStartCommand==='npm start'&&Boolean(result.discordRegistry&&result.apiServer);
console.log(JSON.stringify(result,null,2));if(!result.canonical)process.exitCode=1;
