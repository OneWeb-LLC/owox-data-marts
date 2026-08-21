import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

/** Default TypeORM connection used by the main application schema. */
export function getMainDataSource(app: INestApplication): DataSource {
  return app.get(DataSource);
}
