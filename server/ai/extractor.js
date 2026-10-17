// AI brochure extraction contract (the real implementation plugs in here).
//
//   extractBrochure({ buffer: Buffer, mimeType: string, originalName: string })
//     : Promise<{ fields: object, usage?: { input_tokens: number, output_tokens: number } }>
//
// - It throws on a failed read. The error may carry `err.usage` so failed calls are costed.
// - It must NOT persist the file. If it needs a temp file, it deletes it in `finally`.
// - The stub below throws code 'not_configured'; the gate route answers 503 and counts nothing.

async function extractBrochure() {
    throw Object.assign(new Error('AI extraction not configured'), { code: 'not_configured' });
}

module.exports = { extractBrochure };
