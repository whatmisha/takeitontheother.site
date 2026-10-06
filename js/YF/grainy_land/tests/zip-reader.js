// Independent ZIP32 reader for uncompressed test artifacts.
export function readStoredZip(bytes) {
    const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),decoder=new TextDecoder();
    const end=bytes.length-22;
    if(end<0||v.getUint32(end,true)!==0x06054b50)throw new Error('Missing ZIP directory');
    const count=v.getUint16(end+10,true),offset=v.getUint32(end+16,true),files=[];
    let at=offset;
    for(let i=0;i<count;i++) {
        if(v.getUint32(at,true)!==0x02014b50||v.getUint16(at+10,true)!==0)throw new Error('Invalid ZIP entry');
        const length=v.getUint16(at+28,true),extra=v.getUint16(at+30,true),comment=v.getUint16(at+32,true);
        const size=v.getUint32(at+24,true),local=v.getUint32(at+42,true),checksum=v.getUint32(at+16,true);
        const name=decoder.decode(bytes.subarray(at+46,at+46+length));
        if(v.getUint32(local,true)!==0x04034b50||v.getUint32(local+22,true)!==size||v.getUint32(local+14,true)!==checksum)throw new Error('ZIP headers disagree');
        const dataAt=local+30+v.getUint16(local+26,true)+v.getUint16(local+28,true);
        if(decoder.decode(bytes.subarray(local+30,local+30+length))!==name||dataAt+size>offset)throw new Error('Invalid ZIP bounds');
        files.push({name,checksum,bytes:bytes.slice(dataAt,dataAt+size)});
        at+=46+length+extra+comment;
    }
    if(at!==end||at-offset!==v.getUint32(end+12,true))throw new Error('Invalid ZIP directory size');
    return files;
}
