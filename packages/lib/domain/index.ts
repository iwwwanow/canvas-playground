// Public surface of the domain layer. domain-services and utils are
// intentionally not re-exported here — they're only called from inside
// Layer/Composition methods (see docs/specs/domain.spec.ts).
export * from "./entities";
export * from "./types";
