const gBit = (bit, start, end) => {
    if (end) {
        const mask = (1 << (end - start + 1)) - 1;
        return (bit >>> (start - 1)) & mask;
    } else {
        return (bit >>> (start - 1)) & 1;
    }
};

const ParseBytecode = (byteString) => {
    let pos = 0;

    const gBits8 = () => {
        const byte = byteString.charCodeAt(pos);
        pos += 1;
        return byte;
    };

    const gBits32 = () => {
        const w = byteString.charCodeAt(pos);
        const x = byteString.charCodeAt(pos + 1);
        const y = byteString.charCodeAt(pos + 2);
        const z = byteString.charCodeAt(pos + 3);
        pos += 4;
        return (z * 16777216) + (y * 65536) + (x * 256) + w;
    };

    const gBits64 = () => {
        const a = BigInt(byteString.charCodeAt(pos));
        const b = BigInt(byteString.charCodeAt(pos + 1));
        const c = BigInt(byteString.charCodeAt(pos + 2));
        const d = BigInt(byteString.charCodeAt(pos + 3));
        const e = BigInt(byteString.charCodeAt(pos + 4));
        const f = BigInt(byteString.charCodeAt(pos + 5));
        const g = BigInt(byteString.charCodeAt(pos + 6));
        const h = BigInt(byteString.charCodeAt(pos + 7));
        pos += 8;
        return h * 72057594037927936n + g * 281474976710656n + f * 1099511627776n + e * 4294967296n + d * 16777216n + c * 65536n + b * 256n + a;
    };

    if (byteString.substring(0, 4) !== "\x1bLua") {
        throw new Error("Lua bytecode expected.");
    }
    pos = 4;

    if (gBits8() !== 0x51) {
        throw new Error("Only Lua 5.1 is supported.");
    }

    gBits8();
    if (gBits8() !== 1) {
        throw new Error("Little endian is expected.");
    }

    const intSize = gBits8();
    const size_tSize = gBits8();
    gBits8();
    gBits8();
    gBits8();
    const gInt = (intSize === 4 ? gBits32 : gBits64);
    const gSizet = (size_tSize === 4 ? gBits32 : gBits64);

    const gString = (len) => {
        const length = Number(len ?? gSizet());
        if (length === 0) {
            return "";
        }
        const str = byteString.substring(pos, pos + length);
        pos += length;
        if (str.charCodeAt(str.length - 1) === 0) {
            return str.substring(0, str.length - 1);
        }
        return str;
    };

    const chunkDecode = () => {
        const Chunk = {};

        Chunk.Name = gString();
        Chunk.FirstL = gInt();
        Chunk.LastL = gInt();
        Chunk.Upvals = gBits8();
        Chunk.Args = gBits8();
        Chunk.Vargs = gBits8();
        Chunk.Stack = gBits8();

        const numInstructions = Number(gInt());
        Chunk.Instr = [];
        for (let i = 0; i < numInstructions; i++) {
            const data = gBits32();
            const opco = gBit(data, 1, 6);
            Chunk.Instr.push({ Enum: opco, Value: data });
        }

        const numConstants = Number(gInt());
        Chunk.Const = new Array(numConstants);
        for (let i = 0; i < numConstants; i++) {
            const type = gBits8();
            if (type === 1) {
                Chunk.Const[i] = (gBits8() !== 0);
            } else if (type === 3) { 
                pos += 8;
            } else if (type === 4) {
                Chunk.Const[i] = gString();
            }
        }

        const numPrototypes = Number(gInt());
        Chunk.Proto = [];
        for (let i = 0; i < numPrototypes; i++) {
            Chunk.Proto.push(chunkDecode());
        }

        return Chunk;
    };

    return chunkDecode();
};
