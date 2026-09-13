import { describe, expect, it, jest } from '@jest/globals';
import type { Express } from 'express';
import { AUTH_BASE_PATH } from '../core/constants.js';
import { PageController } from './page-controller.js';

describe('PageController.registerRoutes', () => {
  it('registers GET and POST /auth/magic-link so a POST-preserving redirect is not a 404', () => {
    const controller = new PageController({ google: false, microsoft: false, email: true });
    const app = {
      get: jest.fn(),
      post: jest.fn(),
    } as unknown as Express;

    controller.registerRoutes(app);

    expect(app.get).toHaveBeenCalledWith(`${AUTH_BASE_PATH}/magic-link`, expect.any(Function));
    expect(app.post).toHaveBeenCalledWith(`${AUTH_BASE_PATH}/magic-link`, expect.any(Function));
  });
});
