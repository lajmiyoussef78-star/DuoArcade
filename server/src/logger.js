const ts = () => new Date().toISOString();

export const log = {
  info: (msg, data) => {
    if (data !== undefined) console.log(`[${ts()}] INFO  ${msg}`, data);
    else console.log(`[${ts()}] INFO  ${msg}`);
  },
  warn: (msg, data) => {
    if (data !== undefined) console.warn(`[${ts()}] WARN  ${msg}`, data);
    else console.warn(`[${ts()}] WARN  ${msg}`);
  },
  error: (msg, data) => {
    if (data !== undefined) console.error(`[${ts()}] ERROR ${msg}`, data);
    else console.error(`[${ts()}] ERROR ${msg}`);
  },
};
