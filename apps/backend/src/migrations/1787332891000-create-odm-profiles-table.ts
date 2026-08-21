import { MigrationInterface, QueryRunner, Table } from 'typeorm';
import { softDropTable } from './migration-utils';

export class CreateOdmProfilesTable1787332891000 implements MigrationInterface {
  public readonly name = 'CreateOdmProfilesTable1787332891000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'odm_profiles',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true },
          { name: 'one_id', type: 'varchar', isNullable: true },
          { name: 'email', type: 'varchar', isNullable: true },
          { name: 'full_name', type: 'varchar', isNullable: true },
          { name: 'org_id', type: 'varchar', isNullable: true },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'modifiedAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await softDropTable(queryRunner, 'odm_profiles');
  }
}
