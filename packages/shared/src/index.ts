/**
 * @while-building/shared — generic, framework-free primitives for every app.
 *
 * Keep it free of NestJS, the ORM and anything business-specific, so any layer
 * of any app — including a domain layer — can depend on it. Services,
 * repositories, entities and business events belong to the app that owns them.
 */
export { AppError, type AppErrorKind } from './errors/app-error.js';
