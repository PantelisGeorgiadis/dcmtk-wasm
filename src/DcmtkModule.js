const { WASI, useEnviron, useClock, useStdio } = require('uwasi');
const log = require('./log');

/**
 * WebAssembly module filename.
 * @constant {string}
 */
const wasmFilename = 'dcmtk-wasm.wasm';

/**
 * The wasm-exported functions used by this package. Only these are bound onto
 * the wasm API, so Emscripten runtime internals (malloc, free, __trap,
 * emscripten_stack_*, __cxa_*, ...) stay out of the public surface. The names
 * must match the EMSCRIPTEN_KEEPALIVE functions in wasm/src.
 * @constant {string[]}
 */
const wasmExportedFunctions = Object.freeze([
  // DcmtkContext
  'CreateDcmtkContext',
  'ReleaseDcmtkContext',
  'GetEncodedBuffer',
  'SetEncodedBufferSize',
  'ParseDataset',
  // MetadataContext
  'CreateMetadataContext',
  'ReleaseMetadataContext',
  'GetMetadataContextMetadataBuffer',
  'GetMetadataContextMetadataBufferSize',
  'GetMetadataAsJson',
  // FrameContext
  'CreateFrameContext',
  'ReleaseFrameContext',
  'GetFrameContextFrameIndex',
  'SetFrameContextFrameIndex',
  'GetFrameContextColumns',
  'GetFrameContextRows',
  'GetFrameContextBitsAllocated',
  'GetFrameContextBitsStored',
  'GetFrameContextSamplesPerPixel',
  'GetFrameContextPixelRepresentation',
  'GetFrameContextPlanarConfiguration',
  'GetFrameContextPhotometricInterpretation',
  'GetFrameContextPixelDataBuffer',
  'GetFrameContextPixelDataBufferSize',
  'GetRenderedFrameAsBmp',
  'GetUncompressedFrame',
]);

/**
 * Incremented on every successful initialization, so Dcmtk instances can detect
 * that they were created against a previous WebAssembly instance (their native
 * context pointers then point into a detached heap).
 * @type {number}
 */
let generation = 0;

//#region DcmtkModule
/**
 * Loads and owns the single shared Dcmtk WebAssembly instance.
 * Dcmtk instances share this module's exported wasm API to parse and process
 * as many DICOM datasets as needed without re-instantiating WebAssembly.
 */
class DcmtkModule {
  /**
   * Initializes the shared Dcmtk WebAssembly module.
   * @method
   * @static
   * @async
   * @param {Object} [opts] - DcmtkModule options.
   * @param {string} [opts.webAssemblyModulePathOrUrl] - Custom WebAssembly module path or URL.
   * If not provided, the module is trying to be resolved within the same directory.
   * @param {boolean} [opts.logMessages] - Flag to indicate whether to log informational messages.
   */
  static async initializeAsync(opts) {
    opts = opts || {};
    this.logMessages = opts.logMessages || false;
    this.webAssemblyModulePathOrUrl = opts.webAssemblyModulePathOrUrl;
    this.textDecoder = new TextDecoder();

    const { instance, module } = await this._createWebAssemblyInstance();

    // Only bind the functions this package uses; Emscripten runtime internals
    // (malloc, free, __trap, emscripten_stack_*, __cxa_*, ...) are skipped.
    wasmExportedFunctions.forEach((name) => {
      this.wasmApi[`wasm${name}`] = instance.exports[name];
    });

    this.wasmApi.wasmModule = module;

    // Bump the generation so Dcmtk instances created against a previous
    // instance detect that their native context pointers are stale.
    this.generation = ++generation;
  }

  /**
   * Checks that the given Dcmtk context still belongs to the current WebAssembly
   * instance. Called by Dcmtk before every wasm invocation.
   * @method
   * @static
   * @private
   * @param {number} generation - The generation a Dcmtk instance was created in.
   * @throws {Error} If the module has been re-initialized since then, which would
   * make the instance's native context pointers dangle in a detached heap.
   */
  static _throwIfGenerationIsStale(generation) {
    this._throwIfDcmtkModuleIsNotInitialized();

    if (this.generation !== generation) {
      throw new Error(
        'Dcmtk instance is stale: the Dcmtk module was re-initialized after this ' +
          'instance was created. Create a new Dcmtk instance for the current module.'
      );
    }
  }

  /**
   * Decodes a null-terminated C string at the given WebAssembly memory pointer.
   * @method
   * @static
   * @private
   * @param {number} pointer - Memory pointer to a null-terminated C string,
   * as returned by wasmGetFrameContextPhotometricInterpretation et al.
   * @returns {string} The decoded string.
   * @throws Error if the Dcmtk module is not initialized.
   */
  static wasmCStringToJsString(pointer) {
    this._throwIfDcmtkModuleIsNotInitialized();

    const heap8 = this._getHeap8();
    const end = heap8.indexOf(0, pointer);

    return this._wasmMemoryToJsString(pointer, end - pointer);
  }

  /**
   * Checks if the Dcmtk WebAssembly module is initialized.
   * @method
   * @static
   * @returns {boolean} A flag indicating whether the module is initialized.
   */
  static isInitialized() {
    return this.wasmApi !== undefined;
  }

  /**
   * Releases the shared Dcmtk WebAssembly module.
   * @method
   * @static
   */
  static release() {
    this.wasmApi = undefined;
  }

  //#region Private Methods
  /**
   * Invokes a wasm-exported function, converting a thrown native C++/Wasm
   * exception into a JS Error carrying the message reported via onDcmtkException.
   * Native Wasm exceptions do not carry a usable message property on their own.
   * @method
   * @static
   * @param {Function} wasmFn - wasm-exported function to invoke.
   * @param {...*} args - Arguments to forward to wasmFn.
   * @returns {*} The wasm function's return value.
   * @throws {Error} If the Dcmtk module is not initialized, or wasmFn throws.
   */
  static _callWasm(wasmFn, ...args) {
    this._throwIfDcmtkModuleIsNotInitialized();

    this._lastExceptionMessage = undefined;
    try {
      return wasmFn(...args);
    } catch (e) {
      throw new Error(this._lastExceptionMessage || (e && e.message) || String(e));
    }
  }

  /**
   * Creates WebAssembly instance.
   * @method
   * @static
   * @private
   * @async
   * @returns {Object} WebAssembly instance and module.
   */
  static async _createWebAssemblyInstance() {
    const wasi = new WASI({
      features: [useEnviron(), useClock(), useStdio()],
    });
    /* c8 ignore start */
    const imports = {
      wasi_snapshot_preview1: wasi.wasiImport,
      env: {
        /**
         * Receives a string info message from Dcmtk.
         * @method
         * @param {number} messagePointer - Pointer to the message.
         * @param {number} messageLength - Length of the message.
         */
        onDcmtkMessage: (messagePointer, messageLength) => {
          this._throwIfDcmtkModuleIsNotInitialized();
          if (!this.logMessages) {
            return;
          }

          const str = this._wasmMemoryToJsString(messagePointer, messageLength);
          log.info(`DcmtkModule::onDcmtkInfo::${str}`);
        },

        /**
         * Called by the Dcmtk right before throwing a C++ exception, to
         * surface the failure message to JavaScript.
         * @method
         * @param {number} messagePointer - Pointer to the exception message.
         * @param {number} messageLength - Length of the exception message.
         * @throws {Error} If the module is not initialized.
         */
        onDcmtkException: (messagePointer, messageLength) => {
          this._throwIfDcmtkModuleIsNotInitialized();

          const message = this._wasmMemoryToJsString(messagePointer, messageLength);
          this._lastExceptionMessage = message;
          log.error(`DcmtkModule::onDcmtkException::${message}`);
        },

        /**
         * Called after the WebAssembly memory has grown. The old ArrayBuffer is
         * detached, so any cached view over it is stale; drop it so the next
         * access rebuilds it over the new buffer.
         * @method
         */
        emscripten_notify_memory_growth: () => {
          if (this.wasmApi) {
            this.wasmApi.heap8 = undefined;
          }
        },
        /**
         * Checks file accessibility. No-op since this build never opens files.
         * @method
         * @param {number} a - Directory file descriptor.
         * @param {number} b - Pointer to the file path.
         * @param {number} c - Accessibility check mode.
         * @param {number} d - Flags.
         * @param {number} e - Unused.
         * @returns {number} Error code.
         */
        // eslint-disable-next-line no-unused-vars
        __syscall_faccessat: (a, b, c, d, e) => {
          return 0;
        },

        /**
         * Removes a file. No-op since this build never opens files.
         * @method
         * @param {number} a - Directory file descriptor.
         * @param {number} b - Pointer to the file path.
         * @param {number} c - Flags.
         * @param {number} d - Unused.
         * @returns {number} Error code.
         */
        // eslint-disable-next-line no-unused-vars
        __syscall_unlinkat: (a, b, c, d) => {
          return 0;
        },

        /**
         * Removes a directory. No-op since this build never opens files.
         * @method
         * @param {number} a - Pointer to the directory path.
         * @returns {number} Error code.
         */
        // eslint-disable-next-line no-unused-vars
        __syscall_rmdir: (a) => {
          return 0;
        },

        /**
         * Renames a file. No-op since this build never opens files.
         * @method
         * @param {number} a - Old directory file descriptor.
         * @param {number} b - Pointer to the old path.
         * @param {number} c - New directory file descriptor.
         * @param {number} d - Pointer to the new path.
         * @returns {number} Error code.
         */
        // eslint-disable-next-line no-unused-vars
        __syscall_renameat: (a, b, c, d) => {
          return 0;
        },

        /**
         * Creates a socket. Always fails since no real networking is available or needed
         * (this project never configures a socket/syslog logging appender).
         * @method
         * @returns {number} Negative error code.
         */
        __syscall_socket: () => {
          return -1;
        },

        /**
         * Connects a socket. Always fails; see __syscall_socket.
         * @method
         * @returns {number} Negative error code.
         */
        __syscall_connect: () => {
          return -1;
        },

        /**
         * Sends data on a socket. Always fails; see __syscall_socket.
         * @method
         * @returns {number} Negative error code.
         */
        __syscall_sendto: () => {
          return -1;
        },

        /**
         * Resolves a hostname. Always fails; see __syscall_socket.
         * @method
         * @returns {number} Non-zero error code.
         */
        getaddrinfo: () => {
          return -1;
        },
      },
    };
    /* c8 ignore stop */
    const response = await this._getWebAssemblyResponse();
    let instance;
    let module;
    try {
      // Overlaps fetch + compile for a faster time-to-first-frame.
      ({ instance, module } = await WebAssembly.instantiateStreaming(response, imports));
    } catch {
      /* c8 ignore start */
      // Fall back to non-streaming instantiation when streaming is unavailable
      // (e.g. WebAssembly.instantiateStreaming is missing, or the response lacks
      // the application/wasm content-type). instantiateStreaming may have already
      // consumed the response body before rejecting, so fetch a fresh response
      // instead of reusing the (now unusable) one.
      ({ instance, module } = await WebAssembly.instantiate(
        await (await this._getWebAssemblyResponse()).arrayBuffer(),
        imports
      ));
    }
    /* c8 ignore stop */
    // wasi.initialize() binds the instance to the WASI syscalls and invokes
    // _initialize() itself, so the Emscripten runtime (indirect function table,
    // exception-handling state, codec registration) is set up exactly once.
    wasi.initialize(instance);
    this.wasmApi = {
      wasmInstance: instance,
      wasmMemory: instance.exports.memory,
      // A cached view over the full WebAssembly heap, rebuilt lazily and
      // invalidated when the memory grows (see emscripten_notify_memory_growth).
      heap8: undefined,
    };

    return { instance, module };
  }

  /**
   * Fetches the WebAssembly module as a Response so the browser can stream-compile
   * it (overlapping fetch + compile for a faster time-to-first-frame). In Node the
   * module is read from disk and wrapped in a Response.
   * @method
   * @static
   * @private
   * @async
   * @returns {Response} WebAssembly module response.
   */
  /* c8 ignore start */
  static async _getWebAssemblyResponse() {
    const isNodeJs = !!(
      typeof process !== 'undefined' &&
      process.versions &&
      process.versions.node
    );
    if (!isNodeJs) {
      return fetch(this.webAssemblyModulePathOrUrl || wasmFilename);
    }

    const fs = require('fs');
    const path = require('path');
    const buffer = await fs.promises.readFile(
      this.webAssemblyModulePathOrUrl || path.resolve(__dirname, wasmFilename)
    );

    return new Response(buffer, { headers: { 'content-type': 'application/wasm' } });
  }
  /* c8 ignore stop */

  /**
   * Returns a cached Uint8Array view over the full WebAssembly heap, rebuilding
   * it only when the underlying buffer changes (e.g. after a memory growth).
   * Creating a full-heap view on every call is wasteful, so the view is cached
   * on the module and invalidated by emscripten_notify_memory_growth.
   * @method
   * @static
   * @private
   * @returns {Uint8Array} A view over the current WebAssembly heap.
   * @throws {Error} If the Dcmtk module is not initialized.
   */
  static _getHeap8() {
    this._throwIfDcmtkModuleIsNotInitialized();

    const memory = this.wasmApi.wasmMemory;
    // A cached view is detached when the memory grows (the old ArrayBuffer is
    // replaced), so rebuild it whenever the underlying buffer changes.
    if (!this.wasmApi.heap8 || this.wasmApi.heap8.buffer !== memory.buffer) {
      this.wasmApi.heap8 = new Uint8Array(memory.buffer);
    }

    return this.wasmApi.heap8;
  }

  /**
   * Converts an in-WebAssembly-memory string to a js string.
   * @method
   * @static
   * @private
   * @param {number} pointer - String pointer.
   * @param {number} len - String length.
   * @returns {string} The string object.
   * @throws {Error} If the Dcmtk module is not initialized.
   */
  static _wasmMemoryToJsString(pointer, len) {
    this._throwIfDcmtkModuleIsNotInitialized();

    const heap = this._getHeap8();
    const stringData = new Uint8Array(heap.buffer, pointer, len);

    return this.textDecoder.decode(stringData);
  }

  /**
   * Throws error in case the module is not initialized.
   * @method
   * @static
   * @private
   * @throws {Error} If the module is not initialized.
   */
  static _throwIfDcmtkModuleIsNotInitialized() {
    if (!this.wasmApi) {
      throw new Error('Dcmtk module is not initialized');
    }
  }
  //#endregion
}
//#endregion

//#region Exports
module.exports = DcmtkModule;
//#endregion
