import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const baseline=new URL('../../02/',import.meta.url);
const expected=JSON.parse(await readFile(new URL('backup-02.sha256.json',import.meta.url)));
const current={};
async function visit(directory,prefix=''){
  for(const file of await readdir(directory,{withFileTypes:true})){
    const relative=prefix+file.name;
    if(file.isDirectory())await visit(new URL(file.name+'/',directory),relative+'/');
    else current[relative]=createHash('sha256').update(await readFile(new URL(file.name,directory))).digest('hex');
  }
}
await visit(baseline);
const changed=[...new Set([...Object.keys(expected),...Object.keys(current)])].filter(name=>expected[name]!==current[name]);
if(changed.length){console.error('Backup changed:',changed);process.exitCode=1;}
else console.log(`All ${Object.keys(expected).length} files in website/02 are unchanged.`);
