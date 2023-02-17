This folder contains
- cbor library 
- and modified 'nofilter' 

It's required so that it works on browser.
the issue is the function defined here: [nofilter/lib/index.js#L504](https://github.com/hildjj/nofilter/blob/651f18d26a4d756c5bfe418734b9892a9997a7a8/lib/index.js#L504)
This function works only on nodejs and not on browser