// ZIP method 0: PNG payloads are already compressed. Keep Blob parts rather
// than allocating a second, archive-sized byte array when finalizing.
const encoder=new TextEncoder();
const table=Uint32Array.from({length:256},(_,value)=>{
    for(let bit=0;bit<8;bit++)value=(value&1)?0xedb88320^(value>>>1):value>>>1;
    return value>>>0;
});
const header=size=>new DataView(new ArrayBuffer(size));
export class StoredZipWriter {
    constructor({maxBytes=512*1024*1024}={}) {
        this.maxBytes=Math.min(maxBytes,0xffffffff);
        this.parts=[];this.directory=[];this.names=new Set();this.offset=0;this.directorySize=0;
    }
    async add(name,blob,{signal}={}) {
        signal?.throwIfAborted();
        if(typeof name!=='string'||!name||/[\\/\x00-\x1f]/.test(name))throw new Error('ZIP entries require a plain filename.');
        if(this.names.has(name))throw new Error('Duplicate ZIP filename.');
        if(!(blob instanceof Blob))throw new TypeError('ZIP entry must be a Blob.');
        const encoded=encoder.encode(name),length=encoded.length;
        if(length>65535||this.names.size>=65535)throw new RangeError('ZIP directory is too large.');
        const localSize=30+length+blob.size,centralSize=46+length;
        if(this.offset+this.directorySize+localSize+centralSize+22>this.maxBytes)
            throw new RangeError('ZIP is too large. Reduce export resolution.');
        const bytes=new Uint8Array(await blob.arrayBuffer());let crc=0xffffffff;
        for(let i=0;i<bytes.length;i++)crc=table[(crc^bytes[i])&255]^(crc>>>8);
        crc=(crc^0xffffffff)>>>0;
        signal?.throwIfAborted();
        const local=header(30);
        local.setUint32(0,0x04034b50,true);local.setUint16(4,20,true);
        local.setUint16(6,0x0800,true);local.setUint16(12,0x21,true);
        local.setUint32(14,crc,true);local.setUint32(18,blob.size,true);local.setUint32(22,blob.size,true);
        local.setUint16(26,length,true);
        const central=header(46);
        central.setUint32(0,0x02014b50,true);central.setUint16(4,20,true);central.setUint16(6,20,true);
        central.setUint16(8,0x0800,true);central.setUint16(14,0x21,true);
        central.setUint32(16,crc,true);central.setUint32(20,blob.size,true);central.setUint32(24,blob.size,true);
        central.setUint16(28,length,true);central.setUint32(42,this.offset,true);
        this.parts.push(local.buffer,encoded,blob);this.directory.push(central.buffer,encoded);
        this.offset+=localSize;this.directorySize+=centralSize;this.names.add(name);
    }
    toBlob() {
        const end=header(22);
        end.setUint32(0,0x06054b50,true);end.setUint16(8,this.names.size,true);end.setUint16(10,this.names.size,true);
        end.setUint32(12,this.directorySize,true);end.setUint32(16,this.offset,true);
        return new Blob([...this.parts,...this.directory,end.buffer],{type:'application/zip'});
    }
}
