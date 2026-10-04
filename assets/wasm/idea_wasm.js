let wasm_bindgen = (function(exports) {
    let script_src;
    if (typeof document !== 'undefined' && document.currentScript !== null) {
        script_src = new URL(document.currentScript.src, location.href).toString();
    }

    /**
     * Cipher mode for the text lab.
     * @enum {0 | 1 | 2}
     */
    const Mode = Object.freeze({
        /**
         * Electronic codebook.
         */
        Ecb: 0, "0": "Ecb",
        /**
         * Cipher block chaining.
         */
        Cbc: 1, "1": "Cbc",
        /**
         * Counter mode.
         */
        Ctr: 2, "2": "Ctr",
    });
    exports.Mode = Mode;

    /**
     * Result of [`SealReader::finish`].
     */
    class OpenedFile {
        static __wrap(ptr) {
            const obj = Object.create(OpenedFile.prototype);
            obj.__wbg_ptr = ptr;
            OpenedFileFinalization.register(obj, obj.__wbg_ptr, obj);
            return obj;
        }
        __destroy_into_raw() {
            const ptr = this.__wbg_ptr;
            this.__wbg_ptr = 0;
            OpenedFileFinalization.unregister(this);
            return ptr;
        }
        free() {
            const ptr = this.__destroy_into_raw();
            wasm.__wbg_openedfile_free(ptr, 0);
        }
        /**
         * The original file name.
         * @returns {string}
         */
        get name() {
            let deferred1_0;
            let deferred1_1;
            try {
                const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
                wasm.openedfile_name(retptr, this.__wbg_ptr);
                var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
                var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
                deferred1_0 = r0;
                deferred1_1 = r1;
                return getStringFromWasm0(r0, r1);
            } finally {
                wasm.__wbindgen_add_to_stack_pointer(16);
                wasm.__wbindgen_export2(deferred1_0, deferred1_1, 1);
            }
        }
        /**
         * The final plaintext bytes that CBC held back until the padding was checked.
         * @returns {Uint8Array}
         */
        get tail() {
            try {
                const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
                wasm.openedfile_tail(retptr, this.__wbg_ptr);
                var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
                var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
                var v1 = getArrayU8FromWasm0(r0, r1).slice();
                wasm.__wbindgen_export2(r0, r1 * 1, 1);
                return v1;
            } finally {
                wasm.__wbindgen_add_to_stack_pointer(16);
            }
        }
    }
    if (Symbol.dispose) OpenedFile.prototype[Symbol.dispose] = OpenedFile.prototype.free;
    exports.OpenedFile = OpenedFile;

    /**
     * Streams a sealed file back. Output of `update` is unauthenticated until `finish` succeeds.
     */
    class SealReader {
        __destroy_into_raw() {
            const ptr = this.__wbg_ptr;
            this.__wbg_ptr = 0;
            SealReaderFinalization.unregister(this);
            return ptr;
        }
        free() {
            const ptr = this.__destroy_into_raw();
            wasm.__wbg_sealreader_free(ptr, 0);
        }
        /**
         * Verifies the tag and returns the file name with the last plaintext bytes.
         *
         * # Errors
         * Wrong key or a modified file.
         * @param {Uint8Array} tag
         * @returns {OpenedFile}
         */
        finish(tag) {
            try {
                const ptr = this.__destroy_into_raw();
                const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
                const ptr0 = passArray8ToWasm0(tag, wasm.__wbindgen_export);
                const len0 = WASM_VECTOR_LEN;
                wasm.sealreader_finish(retptr, ptr, ptr0, len0);
                var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
                var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
                var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
                if (r2) {
                    throw takeObject(r1);
                }
                return OpenedFile.__wrap(r0);
            } finally {
                wasm.__wbindgen_add_to_stack_pointer(16);
            }
        }
        /**
         * Parses the 16-byte header.
         *
         * # Errors
         * Wrong key length, or a header this format does not recognise.
         * @param {Uint8Array} key
         * @param {Uint8Array} header
         */
        constructor(key, header) {
            try {
                const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
                const ptr0 = passArray8ToWasm0(key, wasm.__wbindgen_export);
                const len0 = WASM_VECTOR_LEN;
                const ptr1 = passArray8ToWasm0(header, wasm.__wbindgen_export);
                const len1 = WASM_VECTOR_LEN;
                wasm.sealreader_new(retptr, ptr0, len0, ptr1, len1);
                var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
                var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
                var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
                if (r2) {
                    throw takeObject(r1);
                }
                this.__wbg_ptr = r0;
                SealReaderFinalization.register(this, this.__wbg_ptr, this);
                return this;
            } finally {
                wasm.__wbindgen_add_to_stack_pointer(16);
            }
        }
        /**
         * Decrypts a chunk of the bytes between header and tag.
         * @param {Uint8Array} chunk
         * @returns {Uint8Array}
         */
        update(chunk) {
            try {
                const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
                const ptr0 = passArray8ToWasm0(chunk, wasm.__wbindgen_export);
                const len0 = WASM_VECTOR_LEN;
                wasm.sealreader_update(retptr, this.__wbg_ptr, ptr0, len0);
                var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
                var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
                var v2 = getArrayU8FromWasm0(r0, r1).slice();
                wasm.__wbindgen_export2(r0, r1 * 1, 1);
                return v2;
            } finally {
                wasm.__wbindgen_add_to_stack_pointer(16);
            }
        }
    }
    if (Symbol.dispose) SealReader.prototype[Symbol.dispose] = SealReader.prototype.free;
    exports.SealReader = SealReader;

    /**
     * Streams a file into the sealed format. Concatenate every returned chunk.
     */
    class SealWriter {
        __destroy_into_raw() {
            const ptr = this.__wbg_ptr;
            this.__wbg_ptr = 0;
            SealWriterFinalization.unregister(this);
            return ptr;
        }
        free() {
            const ptr = this.__destroy_into_raw();
            wasm.__wbg_sealwriter_free(ptr, 0);
        }
        /**
         * Returns the last ciphertext bytes and the tag. The writer is used up.
         * @returns {Uint8Array}
         */
        finish() {
            try {
                const ptr = this.__destroy_into_raw();
                const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
                wasm.sealwriter_finish(retptr, ptr);
                var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
                var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
                var v1 = getArrayU8FromWasm0(r0, r1).slice();
                wasm.__wbindgen_export2(r0, r1 * 1, 1);
                return v1;
            } finally {
                wasm.__wbindgen_add_to_stack_pointer(16);
            }
        }
        /**
         * Starts a sealed file. `iv` must be 8 fresh random bytes.
         *
         * # Errors
         * Wrong key or IV length, or a file name over 65535 bytes.
         * @param {Uint8Array} key
         * @param {boolean} ctr
         * @param {Uint8Array} iv
         * @param {string} name
         */
        constructor(key, ctr, iv, name) {
            try {
                const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
                const ptr0 = passArray8ToWasm0(key, wasm.__wbindgen_export);
                const len0 = WASM_VECTOR_LEN;
                const ptr1 = passArray8ToWasm0(iv, wasm.__wbindgen_export);
                const len1 = WASM_VECTOR_LEN;
                const ptr2 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export3);
                const len2 = WASM_VECTOR_LEN;
                wasm.sealwriter_new(retptr, ptr0, len0, ctr, ptr1, len1, ptr2, len2);
                var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
                var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
                var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
                if (r2) {
                    throw takeObject(r1);
                }
                this.__wbg_ptr = r0;
                SealWriterFinalization.register(this, this.__wbg_ptr, this);
                return this;
            } finally {
                wasm.__wbindgen_add_to_stack_pointer(16);
            }
        }
        /**
         * Encrypts a chunk; returns the sealed bytes ready so far.
         * @param {Uint8Array} chunk
         * @returns {Uint8Array}
         */
        update(chunk) {
            try {
                const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
                const ptr0 = passArray8ToWasm0(chunk, wasm.__wbindgen_export);
                const len0 = WASM_VECTOR_LEN;
                wasm.sealwriter_update(retptr, this.__wbg_ptr, ptr0, len0);
                var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
                var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
                var v2 = getArrayU8FromWasm0(r0, r1).slice();
                wasm.__wbindgen_export2(r0, r1 * 1, 1);
                return v2;
            } finally {
                wasm.__wbindgen_add_to_stack_pointer(16);
            }
        }
    }
    if (Symbol.dispose) SealWriter.prototype[Symbol.dispose] = SealWriter.prototype.free;
    exports.SealWriter = SealWriter;

    /**
     * Decrypts `data`; arguments as for [`encrypt`].
     *
     * # Errors
     * Wrong key or IV length, ciphertext that is not whole blocks, or bad padding.
     * @param {Uint8Array} key
     * @param {Mode} mode
     * @param {Uint8Array} iv
     * @param {boolean} pad
     * @param {Uint8Array} data
     * @returns {Uint8Array}
     */
    function decrypt(key, mode, iv, pad, data) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(key, wasm.__wbindgen_export);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passArray8ToWasm0(iv, wasm.__wbindgen_export);
            const len1 = WASM_VECTOR_LEN;
            const ptr2 = passArray8ToWasm0(data, wasm.__wbindgen_export);
            const len2 = WASM_VECTOR_LEN;
            wasm.decrypt(retptr, ptr0, len0, mode, ptr1, len1, pad, ptr2, len2);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            if (r3) {
                throw takeObject(r2);
            }
            var v4 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export2(r0, r1 * 1, 1);
            return v4;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    exports.decrypt = decrypt;

    /**
     * Encrypts `data`. `iv` is ignored for ECB; `pad` selects PKCS#7 for ECB and CBC.
     *
     * # Errors
     * Wrong key or IV length, or unpadded input that is not whole blocks.
     * @param {Uint8Array} key
     * @param {Mode} mode
     * @param {Uint8Array} iv
     * @param {boolean} pad
     * @param {Uint8Array} data
     * @returns {Uint8Array}
     */
    function encrypt(key, mode, iv, pad, data) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(key, wasm.__wbindgen_export);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passArray8ToWasm0(iv, wasm.__wbindgen_export);
            const len1 = WASM_VECTOR_LEN;
            const ptr2 = passArray8ToWasm0(data, wasm.__wbindgen_export);
            const len2 = WASM_VECTOR_LEN;
            wasm.encrypt(retptr, ptr0, len0, mode, ptr1, len1, pad, ptr2, len2);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            if (r3) {
                throw takeObject(r2);
            }
            var v4 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export2(r0, r1 * 1, 1);
            return v4;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    exports.encrypt = encrypt;

    /**
     * Multiplication modulo 2^16 + 1, the word 0 standing for 2^16.
     * @param {number} a
     * @param {number} b
     * @returns {number}
     */
    function mul(a, b) {
        const ret = wasm.mul(a, b);
        return ret;
    }
    exports.mul = mul;

    /**
     * Multiplicative inverse modulo 2^16 + 1.
     * @param {number} a
     * @returns {number}
     */
    function mulInv(a) {
        const ret = wasm.mulInv(a);
        return ret;
    }
    exports.mulInv = mulInv;

    /**
     * Length of a sealed file's header.
     * @returns {number}
     */
    function sealHeaderLen() {
        const ret = wasm.sealHeaderLen();
        return ret >>> 0;
    }
    exports.sealHeaderLen = sealHeaderLen;

    /**
     * Length of a sealed file's tag.
     * @returns {number}
     */
    function sealTagLen() {
        const ret = wasm.sealTagLen();
        return ret >>> 0;
    }
    exports.sealTagLen = sealTagLen;

    /**
     * The 52 encryption subkeys followed by the 52 decryption subkeys.
     *
     * # Errors
     * Key not 16 bytes.
     * @param {Uint8Array} key
     * @returns {Uint16Array}
     */
    function subkeys(key) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(key, wasm.__wbindgen_export);
            const len0 = WASM_VECTOR_LEN;
            wasm.subkeys(retptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            if (r3) {
                throw takeObject(r2);
            }
            var v2 = getArrayU16FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export2(r0, r1 * 2, 2);
            return v2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    exports.subkeys = subkeys;

    /**
     * Runs one block through the cipher and returns every intermediate word.
     *
     * Layout: 8 rounds of [`TRACE_ROUND_WORDS`] words (input X1..X4, subkeys
     * Z1..Z6, steps 1..14), then [`TRACE_OUTPUT_WORDS`] words for the output
     * transformation (input, subkeys, output); 204 words in all.
     *
     * # Errors
     * Key not 16 bytes or block not 8 bytes.
     * @param {Uint8Array} key
     * @param {Uint8Array} block
     * @param {boolean} decrypt
     * @returns {Uint16Array}
     */
    function trace(key, block, decrypt) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(key, wasm.__wbindgen_export);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passArray8ToWasm0(block, wasm.__wbindgen_export);
            const len1 = WASM_VECTOR_LEN;
            wasm.trace(retptr, ptr0, len0, ptr1, len1, decrypt);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            if (r3) {
                throw takeObject(r2);
            }
            var v3 = getArrayU16FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export2(r0, r1 * 2, 2);
            return v3;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    exports.trace = trace;
    function __wbg_get_imports() {
        const import0 = {
            __proto__: null,
            __wbg_Error_30c8987f7c2ed4e2: function(arg0, arg1) {
                const ret = Error(getStringFromWasm0(arg0, arg1));
                return addHeapObject(ret);
            },
            __wbg___wbindgen_throw_41e9ee4f547fc59a: function(arg0, arg1) {
                throw new Error(getStringFromWasm0(arg0, arg1));
            },
        };
        return {
            __proto__: null,
            "./idea_wasm_bg.js": import0,
        };
    }

    const OpenedFileFinalization = (typeof FinalizationRegistry === 'undefined')
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(ptr => wasm.__wbg_openedfile_free(ptr, 1));
    const SealReaderFinalization = (typeof FinalizationRegistry === 'undefined')
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(ptr => wasm.__wbg_sealreader_free(ptr, 1));
    const SealWriterFinalization = (typeof FinalizationRegistry === 'undefined')
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(ptr => wasm.__wbg_sealwriter_free(ptr, 1));

    function addHeapObject(obj) {
        if (heap_next === heap.length) heap.push(heap.length + 1);
        const idx = heap_next;
        heap_next = heap[idx];

        heap[idx] = obj;
        return idx;
    }

    function dropObject(idx) {
        if (idx < 1028) return;
        heap[idx] = heap_next;
        heap_next = idx;
    }

    function getArrayU16FromWasm0(ptr, len) {
        ptr = ptr >>> 0;
        return getUint16ArrayMemory0().subarray(ptr / 2, ptr / 2 + len);
    }

    function getArrayU8FromWasm0(ptr, len) {
        ptr = ptr >>> 0;
        return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
    }

    let cachedDataViewMemory0 = null;
    function getDataViewMemory0() {
        if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
            cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
        }
        return cachedDataViewMemory0;
    }

    function getStringFromWasm0(ptr, len) {
        return decodeText(ptr >>> 0, len);
    }

    let cachedUint16ArrayMemory0 = null;
    function getUint16ArrayMemory0() {
        if (cachedUint16ArrayMemory0 === null || cachedUint16ArrayMemory0.byteLength === 0) {
            cachedUint16ArrayMemory0 = new Uint16Array(wasm.memory.buffer);
        }
        return cachedUint16ArrayMemory0;
    }

    let cachedUint8ArrayMemory0 = null;
    function getUint8ArrayMemory0() {
        if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
            cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
        }
        return cachedUint8ArrayMemory0;
    }

    function getObject(idx) { return heap[idx]; }

    let heap = new Array(1024).fill(undefined);
    heap.push(undefined, null, true, false);

    let heap_next = heap.length;

    function passArray8ToWasm0(arg, malloc) {
        const ptr = malloc(arg.length * 1, 1) >>> 0;
        getUint8ArrayMemory0().set(arg, ptr / 1);
        WASM_VECTOR_LEN = arg.length;
        return ptr;
    }

    function passStringToWasm0(arg, malloc, realloc) {
        if (realloc === undefined) {
            const buf = cachedTextEncoder.encode(arg);
            const ptr = malloc(buf.length, 1) >>> 0;
            getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
            WASM_VECTOR_LEN = buf.length;
            return ptr;
        }

        let len = arg.length;
        let ptr = malloc(len, 1) >>> 0;

        const mem = getUint8ArrayMemory0();

        let offset = 0;

        for (; offset < len; offset++) {
            const code = arg.charCodeAt(offset);
            if (code > 0x7F) break;
            mem[ptr + offset] = code;
        }
        if (offset !== len) {
            if (offset !== 0) {
                arg = arg.slice(offset);
            }
            ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
            const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
            const ret = cachedTextEncoder.encodeInto(arg, view);

            offset += ret.written;
            ptr = realloc(ptr, len, offset, 1) >>> 0;
        }

        WASM_VECTOR_LEN = offset;
        return ptr;
    }

    function takeObject(idx) {
        const ret = getObject(idx);
        dropObject(idx);
        return ret;
    }

    let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
    cachedTextDecoder.decode();
    function decodeText(ptr, len) {
        return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
    }

    const cachedTextEncoder = new TextEncoder();

    if (!('encodeInto' in cachedTextEncoder)) {
        cachedTextEncoder.encodeInto = function (arg, view) {
            const buf = cachedTextEncoder.encode(arg);
            view.set(buf);
            return {
                read: arg.length,
                written: buf.length
            };
        };
    }

    let WASM_VECTOR_LEN = 0;

    let wasmModule, wasmInstance, wasm;
    function __wbg_finalize_init(instance, module) {
        wasmInstance = instance;
        wasm = instance.exports;
        wasmModule = module;
        cachedDataViewMemory0 = null;
        cachedUint16ArrayMemory0 = null;
        cachedUint8ArrayMemory0 = null;
        return wasm;
    }

    async function __wbg_load(module, imports) {
        if (typeof Response === 'function' && module instanceof Response) {
            if (!module.ok) {
                throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
            }

            if (typeof WebAssembly.instantiateStreaming === 'function') {
                try {
                    return await WebAssembly.instantiateStreaming(module, imports);
                } catch (e) {
                    const validResponse = expectedResponseType(module.type);

                    if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                        console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                    } else { throw e; }
                }
            }

            const bytes = await module.arrayBuffer();
            return await WebAssembly.instantiate(bytes, imports);
        } else {
            const instance = await WebAssembly.instantiate(module, imports);

            if (instance instanceof WebAssembly.Instance) {
                return { instance, module };
            } else {
                return instance;
            }
        }

        function expectedResponseType(type) {
            switch (type) {
                case 'basic': case 'cors': case 'default': return true;
            }
            return false;
        }
    }

    function initSync(module) {
        if (wasm !== undefined) return wasm;


        if (module !== undefined) {
            if (Object.getPrototypeOf(module) === Object.prototype) {
                ({module} = module)
            } else {
                console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
            }
        }

        const imports = __wbg_get_imports();
        if (!(module instanceof WebAssembly.Module)) {
            module = new WebAssembly.Module(module);
        }
        const instance = new WebAssembly.Instance(module, imports);
        return __wbg_finalize_init(instance, module);
    }

    async function __wbg_init(module_or_path) {
        if (wasm !== undefined) return wasm;


        if (module_or_path !== undefined) {
            if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
                ({module_or_path} = module_or_path)
            } else {
                console.warn('using deprecated parameters for the initialization function; pass a single object instead')
            }
        }

        if (module_or_path === undefined && script_src !== undefined) {
            module_or_path = script_src.replace(/\.js$/, "_bg.wasm");
        }
        const imports = __wbg_get_imports();

        if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
            module_or_path = fetch(module_or_path);
        }

        const { instance, module } = await __wbg_load(await module_or_path, imports);

        return __wbg_finalize_init(instance, module);
    }

    return Object.assign(__wbg_init, { initSync }, exports);
})({ __proto__: null });
