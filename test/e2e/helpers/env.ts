const PHP_PORT = process.env.E2E_PHP_PORT ?? '8917';
export const RECEIVER_URL = process.env.RECEIVER_URL ?? `http://localhost:${PHP_PORT}`;
