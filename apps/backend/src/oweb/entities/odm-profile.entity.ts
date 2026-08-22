import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Local OneID profile projection for the OWeb satellite.
 * `id` matches `auth.users.id`. Table is namespaced (`odm_`) so it never collides with `ao_*`.
 */
@Entity({ name: 'odm_profiles' })
export class OdmProfile {
  @PrimaryColumn({ type: 'varchar' })
  id: string;

  @Column({ name: 'one_id', type: 'varchar', nullable: true })
  oneId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  email?: string | null;

  @Column({ name: 'full_name', type: 'varchar', nullable: true })
  fullName?: string | null;

  @Column({ name: 'org_id', type: 'varchar', nullable: true })
  orgId?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  modifiedAt: Date;
}
