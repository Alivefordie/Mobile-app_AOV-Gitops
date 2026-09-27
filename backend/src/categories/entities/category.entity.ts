import { Column, Entity, Index, ManyToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Recipe } from '../../recipes/entities/recipe.entity';

@Entity('categories')
export class Category extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 120 })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder!: number;

  @ManyToMany(() => Recipe, (recipe) => recipe.categories)
  recipes!: Recipe[];
}
