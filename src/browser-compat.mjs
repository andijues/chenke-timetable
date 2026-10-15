// PDF.js legacy supplies iterator/set/typed-array helpers. Its baseline is newer
// than some embedded WebViews, which also need the standard Promise factory.
if (typeof Promise.withResolvers !== 'function') {
  Object.defineProperty(Promise, 'withResolvers', {
    configurable: true,
    writable: true,
    value: function withResolvers() {
      let resolve, reject;
      const promise = new this((fulfill, fail) => { resolve = fulfill; reject = fail; });
      return {promise, resolve, reject};
    }
  });
}

// Chrome 114 has ReadableStream/getReader but lacks stream async iteration,
// which current PDF.js uses to collect page text and decode compressed data.
if (typeof ReadableStream !== 'undefined' && typeof ReadableStream.prototype[Symbol.asyncIterator] !== 'function') {
  function values({preventCancel=false}={}) {
    const reader=this.getReader();
    let done=false, pending=Promise.resolve();
    const finish=()=>{if(!done){done=true;reader.releaseLock();}};
    const enqueue=operation=>{
      const result=pending.then(operation);
      pending=result.catch(()=>{});
      return result;
    };
    return {
      next:()=>enqueue(async()=>{
        if(done)return {done:true,value:undefined};
        try {const result=await reader.read();if(result.done)finish();return result;}
        catch(error){finish();throw error;}
      }),
      return:value=>enqueue(async()=>{
        if(!done){try {if(!preventCancel)await reader.cancel(value);}finally{finish();}}
        return {done:true,value};
      }),
      [Symbol.asyncIterator](){return this;}
    };
  }
  if(typeof ReadableStream.prototype.values!=='function')Object.defineProperty(ReadableStream.prototype,'values',{configurable:true,writable:true,value:values});
  Object.defineProperty(ReadableStream.prototype,Symbol.asyncIterator,{configurable:true,writable:true,value:ReadableStream.prototype.values});
}
