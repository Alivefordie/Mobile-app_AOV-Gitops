import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { RecipeContent } from './recipe-content.entity';
import { Recipe } from './recipe.entity';

@Entity('recipe_sections')
@Index(['recipeId', 'sortOrder'])
@Check('chk_recipe_sections_sort_order', '"sort_order" >= 0')
export class RecipeSection extends BaseEntity {
  @Column({ name: 'recipe_id', type: 'uuid' })
  recipeId!: string;

  @ManyToOne(() => Recipe, (recipe) => recipe.sections, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'recipe_id' })
  recipe!: Recipe;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_preview', type: 'boolean', default: false })
  isPreview!: boolean;

  @OneToMany(() => RecipeContent, (content) => content.section)
  contents!: RecipeContent[];
}
