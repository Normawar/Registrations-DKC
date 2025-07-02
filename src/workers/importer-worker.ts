
import Papa from 'papaparse';

// This tells TypeScript that `self` is a Worker global scope.
declare const self: Worker;

self.onmessage = (event) => {
    const file = event.data as File;
    if (!file) {
        self.postMessage({ error: 'No file received by worker.' });
        return;
    }

    Papa.parse(file, {
        worker: false, // Run parsing in this worker thread, not another one.
        delimiter: "\t",
        skipEmptyLines: true,
        complete: (results) => {
            // Post the parsed rows back to the main thread.
            self.postMessage({ rows: results.data });
        },
        error: (error: any) => {
            // Post any parsing errors back to the main thread.
            self.postMessage({ error: error.message });
        }
    });
};

// This export is necessary to treat this file as a module.
export {};
