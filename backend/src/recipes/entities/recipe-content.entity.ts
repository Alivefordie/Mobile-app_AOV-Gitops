import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { RecipeSection } from './recipe-section.entity';

export enum RecipeContentType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  TIP = 'tip',
  WARNING = 'warning',
}

@Entity('recipe_contents')
@Index(['sectionId', 'sortOrder'])
@Check('chk_recipe_contents_sort_order', '"sort_order" >= 0')
@Check(
  'chk_recipe_contents_duration',
  '"duration_seconds" IS NULL OR "duration_seconds" >= 0',
)
export class RecipeContent extends BaseEntity {
  @Column({ name: 'section_id', type: 'uuid' })
  sectionId!: string;

  @ManyToOne(() => RecipeSection, (section) => section.contents, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'section_id' })
  section!: RecipeSection;

  @Column({ name: 'content_type', type: 'enum', enum: RecipeContentType })
  contentType!: RecipeContentType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title!: string | null;

  @Column({ name: 'text_content', type: 'text', nullable: true })
  textContent!: string | null;

  @Column({ name: 'media_url', type: 'text', nullable: true })
  mediaUrl!: string | null;

  @Column({ name: 'duration_seconds', type: 'integer', nullable: true })
  durationSeconds!: number | null;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder!: number;
}
