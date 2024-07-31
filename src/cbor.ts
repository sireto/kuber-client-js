
import {Decoder, Encoder, addExtension, DecoderStream} from "cbor-x";
import {Duplex} from "stream";
import {Buffer} from 'buffer'

type CborBackend={
    encode: (val:any)=>Buffer
    decode: (buff:Buffer)=>any
    createStreamDecoder:()=>Duplex
}


function cborxBackend() : CborBackend{
    class AuxData {
        value: any;
        constructor(value: any) {
            this.value = value;
        }
    }
// this is required to override default beehaviour of AuxData
    addExtension({
        Class: AuxData,
        tag: 259, // register our own extension code for 259 tag
        encode(instance:any, encode:any) {
            return encode(instance.value);
        },
        decode(data: any) {
            return new AuxData(data);
        },
    });

    const encoder = new Encoder({
        mapsAsObjects: false,
        useRecords: false,
    });
    const decoder = new Decoder({ mapsAsObjects: false });

    return {
        encode:(x)=> Buffer.from(encoder.encode(x)),
        decode: (x)=>decoder.decode(x),
        createStreamDecoder: ()=>{
            return new DecoderStream({mapsAsObjects:false})
        }
    }

}

const backend=cborxBackend()
export default  backend