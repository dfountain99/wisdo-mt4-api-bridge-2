import { readFile } from 'node:fs/promises';

const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const render=await readFile(new URL('../render.yaml',import.meta.url),'utf8');
const index=await readFile(new URL('../index.js',import.meta.url),'utf8');
const bootstrap=await readFile(new URL('./runtimeMemoryBootstrap.js',import.meta.url),'utf8').catch(()=> '');
const result={
  productionEntrypoint:pkg.scripts?.start,
  renderStartCommand:render.match(/startCommand:\s*(.+)/)?.[1]?.trim(),
  discordRegistry:/createCommandRegistry/.test(index)?'commands/index.js':null,
  apiServer:/startApiServer/.test(index)?'server/apiServer.js':null,
  nodeEngine:pkg.engines?.node,
  memoryBootstrap:/WISDO_MEMORY_SHED_RATIO/.test(bootstrap)&&/import\('\.\.\/index\.js'\)/.test(bootstrap),
  canonical:true,
};
result.canonical=result.productionEntrypoint==='node scripts/runtimeMemoryBootstrap.js'&&result.renderStartCommand==='npm start'&&result.memoryBootstrap&&Boolean(result.discordRegistry&&result.apiServer);
console.log(JSON.stringify(result,null,2));if(!result.canonical)process.exitCode=1;
