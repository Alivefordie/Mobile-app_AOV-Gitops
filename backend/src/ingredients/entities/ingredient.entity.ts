import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { RecipeIngredient } from './recipe-ingredient.entity';

@Entity('ingredients')
export class Ingredient extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => RecipeIngredient, (item) => item.ingredient)
  recipeIngredients!: RecipeIngredient[];
}
