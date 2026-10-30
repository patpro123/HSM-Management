'use strict';

// An expected failure a service wants reported to the caller with an HTTP-style status.
class ServiceError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ServiceError';
    this.status = status;
  }
}

module.exports = { ServiceError };
